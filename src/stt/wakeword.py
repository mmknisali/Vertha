import logging
import io
import os
import time
import wave
from pathlib import Path

import numpy as np

from silero_vad import load_silero_vad, VADIterator
import torch

logger = logging.getLogger('vertha-wakeword')

SAMPLE_RATE = 16000
SPEAKER_ENROLLMENT_PATH = os.getenv('SPEAKER_ENROLLMENT_PATH', '')
SPEAKER_THRESHOLD = 0.15
MIN_SPEECH_MS = 250
MIN_SILENCE_MS = 150
VAD_THRESHOLD = 0.3

class WakeWordDetector:
    def __init__(self):
        self._initialized = False
        self.vad_iterator = None
        self.vad_model = None
        self.enrolled_embedding = None
        self.verification_model = None
        self.audio_buffer = np.array([], dtype=np.float32)
        self.speech_buffer = np.array([], dtype=np.float32)
        self.speech_active = False
        self.last_detection_time = 0

    def initialize(self):
        if self._initialized:
            return

        try:
            if not SPEAKER_ENROLLMENT_PATH:
                raise ValueError('SPEAKER_ENROLLMENT_PATH not set in environment')

            enrollment_path = Path(SPEAKER_ENROLLMENT_PATH)
            if not enrollment_path.exists():
                raise FileNotFoundError(f'Enrollment file not found: {enrollment_path}')

            logger.info(f'Loading enrolled speaker embedding from: {enrollment_path}')
            self.enrolled_embedding = torch.load(enrollment_path, weights_only=False)
            if isinstance(self.enrolled_embedding, list):
                self.enrolled_embedding = torch.stack(self.enrolled_embedding)
            if self.enrolled_embedding.dim() == 1:
                self.enrolled_embedding = self.enrolled_embedding.unsqueeze(0)
            logger.info('Speaker embedding loaded')

            logger.info('Loading Silero VAD model...')
            self.vad_model = load_silero_vad(onnx=False)
            self.vad_iterator = VADIterator(
                self.vad_model,
                sampling_rate=SAMPLE_RATE,
                min_silence_duration_ms=MIN_SILENCE_MS,
                threshold=VAD_THRESHOLD,
                speech_pad_ms=MIN_SPEECH_MS,
            )
            logger.info('Silero VAD model loaded')

            logger.info('Loading SpeechBrain speaker verification model...')
            from speechbrain.inference.speaker import SpeakerRecognition
            self.verification_model = SpeakerRecognition.from_hparams(
                source='speechbrain/spkrec-ecapa-voxceleb',
                savedir='pretrained_models/spkrec-ecapa-voxceleb',
            )
            logger.info('Speaker verification model loaded')

            self._initialized = True
            logger.info('Wake word detector ready (Silero VAD + SpeechBrain)')

        except Exception as e:
            logger.error(f'Wake word initialization failed: {e}')
            self._initialized = False
            raise

    def process_audio(self, audio_bytes, sample_rate=16000):
        if not self._initialized:
            self.initialize()

        try:
            pcm_data = self._convert_to_pcm(audio_bytes, sample_rate)
            if pcm_data is None:
                logger.warning('PCM conversion returned None')
                return []

            logger.debug(f'Processing {len(pcm_data)} samples, buffer now {len(self.audio_buffer) + len(pcm_data)}')
            self.audio_buffer = np.concatenate([self.audio_buffer, pcm_data])

            window_size = 512

            while len(self.audio_buffer) >= window_size:
                chunk = self.audio_buffer[:window_size]
                self.audio_buffer = self.audio_buffer[window_size:]

                vad_result = self.vad_iterator(chunk, return_seconds=False)

                if vad_result:
                    if 'start' in vad_result:
                        self.speech_active = True
                        self.speech_buffer = np.concatenate([self.speech_buffer, chunk])
                        logger.debug('Speech started')
                    elif 'end' in vad_result:
                        self.speech_active = False
                        self.speech_buffer = np.concatenate([self.speech_buffer, chunk])
                        logger.debug(f'Speech ended, buffer size: {len(self.speech_buffer)} samples')
                        verified = self._verify_speaker()
                        self.speech_buffer = np.array([], dtype=np.float32)
                        if verified:
                            return ['vertha']
                elif self.speech_active:
                    self.speech_buffer = np.concatenate([self.speech_buffer, chunk])

                    if len(self.speech_buffer) > SAMPLE_RATE * 10:
                        logger.debug('Speech timeout, forced verification')
                        self.speech_active = False
                        verified = self._verify_speaker()
                        self.speech_buffer = np.array([], dtype=np.float32)
                        if verified:
                            return ['vertha']

            return []

        except Exception as e:
            logger.error(f'Wake word detection error: {e}')
            return []

    def _get_threshold(self):
        return SPEAKER_THRESHOLD

    def _verify_speaker(self):
        min_samples = int(0.3 * SAMPLE_RATE)
        if len(self.speech_buffer) < min_samples:
            logger.debug(f'Speech buffer too short ({len(self.speech_buffer)} samples), skipping')
            return False

        try:
            speech_tensor = torch.FloatTensor(self.speech_buffer)

            with torch.no_grad():
                embedding = self.verification_model.encode_batch(speech_tensor.unsqueeze(0))

            cos_sim = torch.nn.functional.cosine_similarity(
                embedding.squeeze(0),
                self.enrolled_embedding
            ).item()

            now = time.time()
            debounce_ok = (now - self.last_detection_time) > 2.0

            logger.info(f'Speaker verification score: {cos_sim:.3f} (threshold: {SPEAKER_THRESHOLD}, debounce_ok: {debounce_ok})')

            if cos_sim > SPEAKER_THRESHOLD and debounce_ok:
                self.last_detection_time = now
                logger.info(f'Wake word verified! score={cos_sim:.3f}')
                return True

            return False

        except Exception as e:
            logger.error(f'Speaker verification error: {e}')
            return False

    def _convert_to_pcm(self, audio_bytes, sample_rate):
        try:
            if audio_bytes[:4] == b'RIFF':
                return self._convert_wav_to_pcm(audio_bytes)
            elif audio_bytes[:4] == b'\x1aE\xdf\xa3':
                return self._convert_opus_to_pcm(audio_bytes)
            else:
                return np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        except Exception as e:
            logger.error(f'Audio conversion error: {e}')
            return None

    def _convert_wav_to_pcm(self, wav_bytes):
        try:
            wav_buffer = io.BytesIO(wav_bytes)
            with wave.open(wav_buffer, 'rb') as wav_file:
                if wav_file.getnchannels() != 1:
                    raise ValueError('Only mono audio supported')
                frames = wav_file.readframes(wav_file.getnframes())
                pcm = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
                return pcm
        except Exception as e:
            logger.error(f'WAV conversion error: {e}')
            return None

    def _convert_opus_to_pcm(self, opus_bytes):
        return None

    def reset(self):
        if self.vad_iterator is not None:
            self.vad_iterator = VADIterator(
                self.vad_model,
                sampling_rate=SAMPLE_RATE,
                min_silence_duration_ms=MIN_SILENCE_MS,
                threshold=VAD_THRESHOLD,
                speech_pad_ms=MIN_SPEECH_MS,
            )
        self.audio_buffer = np.array([], dtype=np.float32)
        self.speech_buffer = np.array([], dtype=np.float32)
        self.speech_active = False