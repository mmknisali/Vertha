#!/usr/bin/env python3
"""
Speaker Enrollment Script for Vertha Wake Word

Usage (mic recording):
    python scripts/enroll_speaker.py enrollments/vertha.pt

Usage (from audio files):
    python scripts/enroll_speaker.py enrollments/vertha.pt --files voice1.wav voice2.wav

Requirements:
    - ffmpeg installed (for mic recording)
    - pip install torch torchaudio speechbrain numpy soundfile
"""

import argparse
import argparse
import logging
import os
import subprocess
import sys
import tempfile

import numpy as np
import torch
import soundfile as sf
from speechbrain.inference.speaker import SpeakerRecognition

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger('vertha-enroll')

SAMPLE_RATE = 16000
ENROLLMENT_DURATION_SEC = 5


def record_audio_ffmpeg(duration_sec, sample_rate=SAMPLE_RATE):
    logger.info(f'Recording {duration_sec} seconds. Speak now...')

    temp_wav = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
    temp_wav.close()

    try:
        cmd = [
            'ffmpeg', '-y',
            '-f', 'alsa',          # Linux ALSA input
            '-acodec', 'pcm_s16le',
            '-ar', str(sample_rate),
            '-ac', '1',
            '-t', str(duration_sec),
            '-i', 'default',
            temp_wav.name
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            # Try pulseaudio
            cmd[3] = 'pulse'
            result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            logger.error(f'ffmpeg failed: {result.stderr}')
            raise OSError(f'Failed to record audio: {result.stderr}')

        logger.info('Recording complete.')
        waveform, sr = sf.read(temp_wav.name, dtype='float32')
        if sr != sample_rate:
            import torchaudio.functional as F
            waveform_tensor = torch.from_numpy(waveform).unsqueeze(0)
            waveform_tensor = F.resample(waveform_tensor, sr, sample_rate)
            waveform = waveform_tensor.squeeze(0).numpy()
        else:
            if waveform.ndim == 2:
                waveform = waveform.mean(axis=-1)
        waveform = waveform.flatten()

    finally:
        os.unlink(temp_wav.name)

    return waveform


def load_audio_file(path, sample_rate=SAMPLE_RATE):
    waveform, sr = sf.read(path, dtype='float32')
    if sr != sample_rate:
        import torchaudio.functional as F
        waveform_tensor = torch.from_numpy(waveform).unsqueeze(0)
        waveform_tensor = F.resample(waveform_tensor, sr, sample_rate)
        waveform = waveform_tensor.squeeze(0).numpy()
    else:
        if waveform.ndim == 2:
            waveform = waveform.mean(axis=-1)
    return waveform


def enroll_from_files(audio_paths, output_path):
    logger.info('Loading speaker verification model...')
    verification = SpeakerRecognition.from_hparams(
        source='speechbrain/spkrec-ecapa-voxceleb',
        savedir='pretrained_models/spkrec-ecapa-voxceleb',
    )

    embeddings = []
    for path in audio_paths:
        logger.info(f'Processing: {path}')
        waveform = load_audio_file(path)
        embedding = verification.encode_batch(waveform.unsqueeze(0))
        embeddings.append(embedding.squeeze(0))
        logger.info(f'  Extracted embedding from {path}')

    enrollment_embedding = torch.stack(embeddings).mean(dim=0)
    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
    torch.save(enrollment_embedding, output_path)
    logger.info(f'Saved enrollment embedding ({enrollment_embedding.shape}) to {output_path}')
    return enrollment_embedding


def enroll_from_mic(output_path):
    logger.info('Loading speaker verification model...')
    verification = SpeakerRecognition.from_hparams(
        source='speechbrain/spkrec-ecapa-voxceleb',
        savedir='pretrained_models/spkrec-ecapa-voxceleb',
    )

    audio = record_audio_ffmpeg(ENROLLMENT_DURATION_SEC)

    waveform = torch.from_numpy(audio).float().unsqueeze(0)
    embedding = verification.encode_batch(waveform)
    enrollment_embedding = embedding.squeeze(0)

    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
    torch.save(enrollment_embedding, output_path)
    logger.info(f'Saved enrollment embedding to {output_path}')
    logger.info('Enrollment complete!')

    return enrollment_embedding


def main():
    parser = argparse.ArgumentParser(description='Enroll speaker for Vertha wake word')
    parser.add_argument('output', nargs='?', default='enrollments/vertha.pt',
                        help='Output path for enrollment file (default: enrollments/vertha.pt)')
    parser.add_argument('--files', nargs='*', help='Audio files to enroll from instead of recording mic')
    args = parser.parse_args()

    output_path = args.output

    if args.files:
        enroll_from_files(args.files, output_path)
    else:
        enroll_from_mic(output_path)

    logger.info('Enrollment complete!')


if __name__ == '__main__':
    main()
