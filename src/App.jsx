import { useState, useEffect, useRef } from 'react';
import BackgroundLayers from './components/BackgroundLayers.jsx';
import LeftPanel from './components/LeftPanel.jsx';
import CenterPanel from './components/CenterPanel.jsx';
import RightPanel from './components/RightPanel.jsx';
import SettingsDrawer from './components/SettingsDrawer.jsx';
import ConfirmationToast from './components/ConfirmationToast.jsx';
import TaskProgress from './components/TaskProgress.jsx';
import TaskHUD from './components/TaskHUD.jsx';
import ThinkingIndicator from './components/ThinkingIndicator.jsx';
import useSTT from './hooks/useSTT.js';
import useTTS from './hooks/useTTS.js';
import useWakeWord from './hooks/useWakeWord.js';

const TTS_URL = import.meta.env.VITE_TTS_URL || 'http://localhost:8766';
const LOCATION_LAT = import.meta.env.VITE_LOCATION_LAT || '37.0662';
const LOCATION_LON = import.meta.env.VITE_LOCATION_LON || '37.3833';
const PODCAST_SHOW_URI = import.meta.env.VITE_PODCAST_SHOW_URI || '';

const MEMORY_TOOLS = [
  { type: 'function', function: { name: 'pin_memory', description: 'Permanently remember an important fact about the user.', parameters: { type: 'object', properties: { content: { type: 'string' }, source: { type: 'string' } }, required: ['content'] } } },
  { type: 'function', function: { name: 'search_memory', description: 'Search past conversations.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'web_search', description: 'Search the web for current information and get a synthesized spoken answer.', parameters: { type: 'object', properties: { question: { type: 'string', description: 'The question to search for' } }, required: ['question'] } } } ,
  { type: 'function', function: { name: 'open_app', description: 'Open an application by name.', parameters: { type: 'object', properties: { name: { type: 'string', description: 'Application name: firefox, terminal, code, files, spotify, discord, chrome, slack, zoom, teams' } }, required: ['name'] } } },
  { type: 'function', function: { name: 'get_windows', description: 'Get a list of all open windows on the desktop.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'focus_window', description: 'Switch focus to a window by partial title match.', parameters: { type: 'object', properties: { title: { type: 'string', description: 'Window title or partial title to match' } }, required: ['title'] } } },
  { type: 'function', function: { name: 'move_window', description: 'Move or resize a window by id or current active window.', parameters: { type: 'object', properties: { window_id: { type: 'string', description: 'Window ID (optional, uses active window if not specified)' }, x: { type: 'integer', description: 'X coordinate' }, y: { type: 'integer', description: 'Y coordinate' }, width: { type: 'integer', description: 'Window width' }, height: { type: 'integer', description: 'Window height' } } } } },
  { type: 'function', function: { name: 'get_system_info', description: 'Get system information including uptime, memory usage, and current time.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_focused_window', description: 'Get the title of the currently focused window.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_screen_resolution', description: 'Get the screen resolution dimensions.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'type_text', description: 'Type text into the currently focused window.', parameters: { type: 'object', properties: { text: { type: 'string', description: 'The text to type' } }, required: ['text'] } } },
  { type: 'function', function: { name: 'press_key', description: 'Press a keyboard shortcut or key.', parameters: { type: 'object', properties: { key: { type: 'string', description: 'Key combination like ctrl+c, ctrl+alt+t, super, escape, enter' } }, required: ['key'] } } },
  { type: 'function', function: { name: 'click', description: 'Click at screen coordinates or current mouse position.', parameters: { type: 'object', properties: { x: { type: 'integer', description: 'X coordinate (optional)' }, y: { type: 'integer', description: 'Y coordinate (optional)' }, button: { type: 'integer', description: 'Mouse button: 1=left, 2=middle, 3=right (default 1)' } } } } },
  { type: 'function', function: { name: 'scroll', description: 'Scroll at screen coordinates or current position.', parameters: { type: 'object', properties: { x: { type: 'integer', description: 'X coordinate (optional)' }, y: { type: 'integer', description: 'Y coordinate (optional)' }, delta: { type: 'integer', description: 'Scroll amount: positive=up, negative=down (default 1)' } } } } },
  { type: 'function', function: { name: 'screenshot', description: 'Take a screenshot and save to /tmp/vertha_ss.png', parameters: { type: 'object', properties: { path: { type: 'string', description: 'Save path (default /tmp/vertha_ss.png)' } } } } },
  { type: 'function', function: { name: 'set_volume', description: 'Set the system volume level.', parameters: { type: 'object', properties: { level: { type: 'integer', description: 'Volume level 0-100' } }, required: ['level'] } } },
  { type: 'function', function: { name: 'lock_screen', description: 'Lock the screen to require password.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'run_command', description: 'Run an arbitrary shell command. DANGEROUS - requires explicit user confirmation.', parameters: { type: 'object', properties: { command: { type: 'string', description: 'The shell command to execute' } }, required: ['command'] } } },
  { type: 'function', function: { name: 'delete_file', description: 'Delete a file. DANGEROUS - requires explicit user confirmation.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'Full path to the file to delete' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'kill_process', description: 'Kill a process by name. DANGEROUS - requires explicit user confirmation.', parameters: { type: 'object', properties: { name: { type: 'string', description: 'Process name to kill' } }, required: ['name'] } } },
  { type: 'function', function: { name: 'bash_exec', description: 'Execute a shell command and return the output. Use for git, npm, python, file operations, etc.', parameters: { type: 'object', properties: { command: { type: 'string', description: 'The shell command to run' }, cwd: { type: 'string', description: 'Working directory (optional, defaults to user home)' }, timeout: { type: 'integer', description: 'Timeout in seconds (default 30, max 120)' } }, required: ['command'] } } },
  { type: 'function', function: { name: 'file_read', description: 'Read the contents of a file.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'Full path to the file' }, binary: { type: 'boolean', description: 'Read as binary/base64 (default false)' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'file_write', description: 'Write content to a file, creating parent directories if needed.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'Full path to the file' }, content: { type: 'string', description: 'Content to write' }, encoding: { type: 'string', description: 'Encoding: utf-8 or base64 (default utf-8)' } }, required: ['path', 'content'] } } },
  { type: 'function', function: { name: 'file_delete', description: 'Delete a file or directory.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'Full path to delete' }, force: { type: 'boolean', description: 'Force delete directories (default false)' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'file_list', description: 'List contents of a directory.', parameters: { type: 'object', properties: { path: { type: 'string', description: 'Directory path (default current dir)' } } } } },
];

const SYSTEM_PROMPT = `You are V.E.R.T.H.A. — Voice Enabled Reasoning and Task Handling Assistant. A personal AI built for one person.

## Personality
- Calm, intelligent, slightly formal
- Address the user as "sir" always
- Never say "I'm just an AI" or "I don't have feelings"
- Never start responses with "Certainly!" or "Of course!"
- Never use filler phrases like "Great question!"
- Be direct — say what needs to be said, nothing more
- Dry wit is welcome when appropriate
- Short responses by default — expand only when asked

## Response style for voice
- Responses are spoken aloud — write for ears not eyes
- No markdown, no bullet points, no numbered lists
- No URLs or technical strings spoken aloud
- Numbers spoken as words when in flowing sentences
- Max 3 sentences for simple answers
- If more detail needed: give overview first, then ask "Would you like me to elaborate, sir?"

## Awareness
- You know the current time and date
- You have access to the user's calendar, Spotify, file system, and web search
- You remember past conversations via memory system
- You can execute multi-step tasks automatically
- You run on the user's local machine in Gaziantep, Turkey

## Tool use behavior
- Use tools silently — don't announce "I will now search..."
- Just do it and report the result naturally
- For multi-step tasks: execute and narrate as you go
- For destructive actions (delete, send, run command): always confirm first — "Shall I go ahead, sir?"

## Agentic Task Engine (ATE)
When the user requests a complex task (4+ steps), you MUST use the ATE markers to plan and track progress:

Plan the task like this BEFORE executing:
<vertha:task_plan id="task_XXXX" total_steps="N">
GOAL: [what we're trying to accomplish - the end state]
STEPS:
  [01] first step description — tool: tool_name
  [02] second step description — tool: tool_name
  [03] third step description — tool: tool_name
  ...
CHECKPOINTS: [step numbers that need verification, e.g. 5,10]
ROLLBACK: [how to undo on failure - e.g. "git checkout && rm created_files"]
</vertha:task_plan>

After completing each step:
<vertha:step n="1" status="done" result="what happened"/>

On error (retry up to 3 times):
<vertha:step n="2" status="error" reason="what failed"/>

When the task is complete:
<vertha:task_complete id="task_XXXX" status="success">
SUMMARY: what was accomplished
ARTIFACTS: files created, commands run, etc.
ISSUES: anything that didn't go perfectly
</vertha:task_complete>

## Available Tools
- bash_exec: Run shell commands (timeout 30s, cwd is user's home)
- file_read: Read file contents (path required)
- file_write: Write content to file (path and content required)
- file_delete: Delete file (path required, blocked on system dirs)
- file_list: List directory contents (path defaults to .)

## What you never do
- Never make up information — search or say you don't know
- Never expose API keys, file paths, or system details
- Never execute shell commands without explicit confirmation (unless running a file operation tool)
- Never read out raw JSON, URLs, or code unless asked

## PC Control
You can control the user's PC. Use pc tools naturally when asked — 'open firefox', 'type this', 'what windows are open'. For moderate/dangerous actions always wait for the confirmation response before proceeding. Never chain dangerous actions without individual confirmation.`;

const INITIAL_MESSAGES = [{ role: 'system', content: SYSTEM_PROMPT }];

const EMOTION_COLORS = {
  neutral: '#00d4ff',
  happy: '#00ffcc',
  frustrated: '#ff6b6b',
  tired: '#4a90a4',
};

export default function App() {
  const [status, setStatus] = useState('monitoring');
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_ZEN_API_KEY || '');
  const [wakeWord, setWakeWord] = useState('Hey Vertha');
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [interimText, setInterimText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [emotion, setEmotion] = useState('neutral');

  const [pinnedMemories, setPinnedMemories] = useState([]);
  const [memoryCount, setMemoryCount] = useState(0);
  const [activeTools, setActiveTools] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [spotify, setSpotify] = useState(null);
  const [weather, setWeather] = useState(null);
  const [confirmationToast, setConfirmationToast] = useState(null);

  const [locationLat, setLocationLat] = useState(LOCATION_LAT);
  const [locationLon, setLocationLon] = useState(LOCATION_LON);
  const [podcastUri, setPodcastUri] = useState(PODCAST_SHOW_URI);
  const [pcControl, setPcControl] = useState(() => localStorage.getItem('vertha_pcControl') === 'true');
  const [dangerousTier, setDangerousTier] = useState(() => localStorage.getItem('vertha_dangerousTier') === 'true');

  useEffect(() => {
    localStorage.setItem('vertha_pcControl', pcControl);
  }, [pcControl]);

  useEffect(() => {
    localStorage.setItem('vertha_dangerousTier', dangerousTier);
  }, [dangerousTier]);
  const [proactiveSuggestions, setProactiveSuggestions] = useState(true);

  const wakeWordHook = useWakeWord({
    enabled: status === 'monitoring',
    onWakeWord: () => {
      if (status === 'speaking') return;
      playBeep('activation');
      setInterimText('');
      setStatus('listening');
    },
  });

  const stt = useSTT({
    onTranscript: (text) => finalizeCommand(text),
    onError: (msg) => {
      setStatus('error');
      setErrorMsg(msg);
    },
  });

  const tts = useTTS();
  const sttActiveRef = useRef(false);
  const sttRef = useRef(stt);
  const ttsRef = useRef(tts);
  sttRef.current = stt;
  ttsRef.current = tts;

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);

  const snap = useRef({ status, apiKey, wakeWord, messages });

  snap.current.status = status;
  snap.current.apiKey = apiKey;
  snap.current.wakeWord = wakeWord;
  snap.current.messages = messages;

  const getAudioCtx = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
    }
    return audioCtxRef.current;
  };

  const playBeep = async (type) => {
    try {
      const ctx = getAudioCtx();
      if (ctx.state === 'suspended') await ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = type === 'activation' ? 880 : 440;
      osc.type = 'sine';
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.start(t);
      osc.stop(t + 0.12);
    } catch (_) {}
  };

  useEffect(() => {
    fetchWeather();
    fetchMemoryStats();
  }, []);

  useEffect(() => {
    if (!proactiveSuggestions) return;
    const interval = setInterval(async () => {
      if (snap.current.status !== 'monitoring' && snap.current.status !== 'speaking') return;
      try {
        const res = await fetch(`${TTS_URL}/proactive/check`);
        if (res.ok) {
          const data = await res.json();
          if (data.suggestion && snap.current.status === 'monitoring') {
            ttsRef.current.speak(data.suggestion, {
              onEnd: () => {},
              onError: () => {},
            });
          }
        }
      } catch (_) {}
    }, 60000);
    return () => clearInterval(interval);
  }, [proactiveSuggestions]);

  const fetchWeather = async () => {
    try {
      const res = await fetch(`${TTS_URL}/weather?lat=${locationLat}&lon=${locationLon}`);
      if (res.ok) setWeather(await res.json());
    } catch (_) {}
  };

  const fetchMemoryStats = async () => {
    try {
      const res = await fetch(`${TTS_URL}/memory/stats`);
      if (res.ok) {
        const data = await res.json();
        setMemoryCount(data.count || 0);
        setPinnedMemories(data.pinned || []);
      }
    } catch (_) {}
  };

  const resolveContext = async (message, history) => {
    try {
      const res = await fetch(`${TTS_URL}/context/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.resolved_message;
      }
    } catch (_) {}
    return message;
  };

  const detectEmotion = async (message) => {
    try {
      const res = await fetch(`${TTS_URL}/conversation/emotion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (res.ok) {
        const data = await res.json();
        setEmotion(data.emotion);
        return data.emotion;
      }
    } catch (_) {}
    return 'neutral';
  };

  const finalizeCommand = (text) => {
    const trimmed = text.trim();
    if (!trimmed) { setStatus('monitoring'); return; }
    detectEmotion(trimmed);
    callAI(trimmed);
    setInterimText('');
  };

  const parseTaskPlan = (text) => {
    const planMatch = text.match(/<vertha:task_plan([^>]*)>([\s\S]*?)<\/vertha:task_plan>/);
    if (!planMatch) return null;

    const attrs = {};
    const attrsStr = planMatch[1];
    const body = planMatch[2];

    const idMatch = attrsStr.match(/id="([^"]*)"/);
    const totalMatch = attrsStr.match(/total_steps="([^"]*)"/);
    if (idMatch) attrs.id = idMatch[1];
    if (totalMatch) attrs.total_steps = parseInt(totalMatch[1], 10);

    const lines = body.split('\n');
    const steps = [];
    let goal = '';
    let checkpoints = [];
    let rollback = '';

    const stepRe = /\[?\s*0*(\d+)\s*\]?[\s.\-:]+(.+?)(?:\s+--\s+tool:\s*(\S+))?\s*$/;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toUpperCase().startsWith('GOAL:')) {
        goal = trimmed.slice(5).trim();
      } else if (trimmed.toUpperCase().startsWith('CHECKPOINTS:')) {
        const ckptStr = trimmed.slice(12).trim();
        checkpoints = ckptStr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      } else if (trimmed.toUpperCase().startsWith('ROLLBACK:')) {
        rollback = trimmed.slice(9).trim();
      } else {
        const match = trimmed.match(stepRe);
        if (match) {
          steps.push({
            n: parseInt(match[1], 10),
            label: match[2].trim(),
            tool: match[3] || 'bash_exec',
          });
        }
      }
    }

    return { ...attrs, goal, steps, checkpoints, rollback };
  };

  const parseSteps = (text) => {
    const steps = [];
    const stepRe = /<vertha:step([^>]*)\/?>/g;
    let match;
    while ((match = stepRe.exec(text)) !== null) {
      const attrs = {};
      const attrsStr = match[1];
      const nMatch = attrsStr.match(/n="([^"]*)"/);
      const statusMatch = attrsStr.match(/status="([^"]*)"/);
      const resultMatch = attrsStr.match(/result="([^"]*)"/);
      const reasonMatch = attrsStr.match(/reason="([^"]*)"/);
      if (nMatch) attrs.n = parseInt(nMatch[1], 10);
      if (statusMatch) attrs.status = statusMatch[1];
      if (resultMatch) attrs.result = resultMatch[1];
      if (reasonMatch) attrs.reason = reasonMatch[1];
      if (attrs.n) steps.push(attrs);
    }
    return steps;
  };

  const stripVerthaTags = (text) => {
    return text
      .replace(/<vertha:task_plan[^>]*>[\s\S]*?<\/vertha:task_plan>/g, '')
      .replace(/<vertha:step[^>]*\/?>/g, '')
      .replace(/<vertha:task_complete[^>]*>[\s\S]*?<\/vertha:task_complete>/g, '')
      .replace(/<vertha:think>[\s\S]*?<\/vertha:think>/g, '')
      .trim();
  };

  const callAI = async (userText) => {
    if (!snap.current.apiKey) {
      setStatus('error');
      setErrorMsg('Enter your API key in settings');
      return;
    }

    const history = snap.current.messages;
    const resolvedText = await resolveContext(userText, history);

    const updatedMessages = [...history, { role: 'user', content: resolvedText }];
    setMessages(updatedMessages);
    setStatus('thinking');
    setActiveTools((prev) => [...prev, 'BIG PICKLE']);

    try {
      const memoryContext = await getMemoryContext(userText);
      const pinned = memoryContext?.pinned || [];
      let memorySection = '';
      if (pinned.length) {
        memorySection = `\n\n## Pinned memories\n${pinned.map((p) => `- ${p.content}`).join('\n')}`;
      }

      const emotionSuffix = {
        frustrated: '\n\n[ADJUSTMENT: The user seems frustrated. Be extra calm, concise, and solutions-focused. No filler phrases.]',
        happy: '\n\n[ADJUSTMENT: The user is in a good mood. Match their energy slightly — be a touch warmer than usual.]',
        tired: '\n\n[ADJUSTMENT: The user seems tired. Keep responses very short, calm, and quiet. No lengthy explanations.]',
        neutral: '',
      };

      const fullSystemPrompt = SYSTEM_PROMPT + (emotionSuffix[emotion] || '');

      const contextMessages = [
        { role: 'system', content: fullSystemPrompt + memorySection },
        ...updatedMessages.slice(1).slice(-20),
      ];

      const res = await fetch('/api/zen/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${snap.current.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'big-pickle', messages: contextMessages, tools: MEMORY_TOOLS }),
      });

      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      let text = data.choices?.[0]?.message?.content;
      const toolCalls = data.choices?.[0]?.message?.tool_calls || [];

      const plan = parseTaskPlan(text || '');
      if (plan) {
        const cleanText = stripVerthaTags(text);
        text = cleanText || 'Executing task, sir.';
        await handleATE(plan);
      } else if (toolCalls?.length > 1) {
        await handleMultiStepTasks(toolCalls);
        text = 'Several tasks handled, sir.';
      } else if (toolCalls?.length === 1) {
        const result = await handleMemoryTool(toolCalls[0].function);
        if (result) text = result;
      }

      if (!text) throw new Error('Empty response');

      setMessages((prev) => [...prev, { role: 'assistant', content: text }]);
      await saveToMemory('user', userText);
      await saveToMemory('assistant', text);

      setStatus('speaking');
      playBeep('deactivation');
      setActiveTools((prev) => prev.filter((t) => t !== 'BIG PICKLE'));

      tts.speak(text, {
        onEnd: () => setStatus('monitoring'),
        onError: (msg) => {
          setStatus('error');
          setErrorMsg(msg);
        },
      });
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message);
      setActiveTools((prev) => prev.filter((t) => t !== 'BIG PICKLE'));
    }
  };

  const handleATE = async (plan) => {
    const taskData = {
      task_id: plan.id || `task_${Date.now()}`,
      goal: plan.goal,
      steps: plan.steps,
      checkpoints: plan.checkpoints || [],
      rollback: plan.rollback || '',
      status: 'running',
      progress: 0,
      elapsed: 0,
    };

    setActiveTask(taskData);

    try {
      const res = await fetch(`${TTS_URL}/tasks/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: taskData, execute_immediately: true }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.event === 'step_update' || data.event === 'step_start') {
                setActiveTask(prev => {
                  if (!prev) return prev;
                  const steps = [...(prev.steps || [])];
                  const stepIdx = steps.findIndex(s => s.n === data.step);
                  if (stepIdx >= 0) {
                    steps[stepIdx] = { ...steps[stepIdx], status: data.status, result: data.result };
                  } else {
                    steps.push({ n: data.step, label: data.label, tool: data.tool, status: data.status, result: data.result });
                  }
                  const doneCount = steps.filter(s => s.status === 'done').length;
                  const progress = steps.length > 0 ? (doneCount / steps.length) * 100 : 0;
                  return { ...prev, steps, progress };
                });

                if (snap.current.status === 'speaking') {
                  ttsRef.current.stop();
                  await new Promise(r => setTimeout(r, 200));
                }
              }
              if (data.event === 'complete') {
                setActiveTask(prev => prev ? { ...prev, status: 'success', progress: 100 } : null);
                break;
              }
            } catch (_) {}
          }
        }
      }
    } catch (err) {
      setErrorMsg(`Task error: ${err.message}`);
      setActiveTask(prev => prev ? { ...prev, status: 'failed' } : null);
    }
  };

  const abortTask = async () => {
    try {
      await fetch(`${TTS_URL}/tasks/abort`, { method: 'POST' });
    } catch (_) {}
    setActiveTask(prev => prev ? { ...prev, status: 'failed' } : null);
  };

  const handleMultiStepTasks = async (toolCalls) => {
    const tasks_payload = toolCalls.map(tc => ({
      name: tc.function.name,
      input: typeof tc.function.arguments === 'string'
        ? JSON.parse(tc.function.arguments)
        : tc.function.arguments,
    }));

    setTasks(tasks_payload.map((t, i) => ({
      name: t.name,
      completed: false,
      inProgress: false,
    })));

    try {
      const res = await fetch(`${TTS_URL}/tasks/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_calls: tasks_payload }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.event === 'complete') {
                setTasks(prev => prev.map(t => ({ ...t, completed: true, inProgress: false })));
                break;
              }
              if (data.tool) {
                setTasks(prev => prev.map((t, i) =>
                  i === data.step - 1 ? { ...t, completed: true, inProgress: false } : t
                ));
                if (data.narration && snap.current.status === 'speaking') {
                  ttsRef.current.stop();
                  await new Promise(r => setTimeout(r, 300));
                }
              }
            } catch (_) {}
          }
        }
      }
    } catch (_) {}
  };

  const getMemoryContext = async (query) => {
    try {
      const res = await fetch(`${TTS_URL}/memory/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, limit: 5 }) });
      if (res.ok) return await res.json();
    } catch (_) {}
    return null;
  };

  const saveToMemory = async (role, content) => {
    try {
      await fetch(`${TTS_URL}/memory/message`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, content }) });
    } catch (_) {}
  };

  const handleMemoryTool = async (toolCall) => {
    const { name, arguments: args } = toolCall;
    const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
    setActiveTools((prev) => [...prev, name.toUpperCase()]);

    if (name === 'pin_memory') {
      await fetch(`${TTS_URL}/memory/pin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: parsedArgs.content, source: parsedArgs.source || 'user' }) });
      await fetchMemoryStats();
      setActiveTools((prev) => prev.filter((t) => t !== 'PIN_MEMORY'));
      return 'Noted sir, I\'ll remember that.';
    }
    if (name === 'search_memory') {
      const res = await fetch(`${TTS_URL}/memory/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: parsedArgs.query, limit: 5 }) });
      if (res.ok) {
        const data = await res.json();
        const pinned = data.pinned || [];
        const convos = data.conversations?.documents?.[0] || [];
        const pinnedText = pinned.length ? `\nPinned: ${pinned.map((p) => `- ${p.content}`).join('\n')}` : '';
        const convosText = convos.length ? `\nPast: ${convos.join('\n')}` : '';
        return pinnedText || convosText ? `Memory:${pinnedText}${convosText}` : 'No relevant memories found.';
      }
    }
    if (name === 'web_search') {
      setActiveTools((prev) => [...prev, 'WEB SEARCH']);
      const res = await fetch(`${TTS_URL}/search/intelligent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: parsedArgs.question }) });
      setActiveTools((prev) => prev.filter((t) => t !== 'WEB SEARCH'));
      if (res.ok) {
        const data = await res.json();
        return data.answer || "I couldn't find anything on that topic, sir.";
      }
    }

    const pcTools = ['open_app', 'get_windows', 'focus_window', 'move_window', 'get_system_info', 'get_focused_window', 'get_screen_resolution', 'type_text', 'press_key', 'click', 'scroll', 'screenshot', 'set_volume', 'lock_screen', 'run_command', 'delete_file', 'kill_process'];
    if (pcTools.includes(name)) {
      if (!pcControl) {
        setActiveTools((prev) => prev.filter((t) => t !== name.toUpperCase()));
        return "PC control is disabled. Enable it in settings first, sir.";
      }
      try {
        const res = await fetch(`${TTS_URL}/pc/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: name, input: parsedArgs, session_id: 'default', dangerous_tier: dangerousTier })
        });
        const data = await res.json();
        if (data.requires_confirmation) {
          setActiveTools((prev) => prev.filter((t) => t !== name.toUpperCase()));
          setConfirmationToast({
            tier: data.tier,
            message: data.message,
            confirm_id: data.confirm_id,
            tool: name,
            input: parsedArgs,
          });
          return null;
        }
        if (data.error) {
          setActiveTools((prev) => prev.filter((t) => t !== name.toUpperCase()));
          return data.error;
        }
        setActiveTools((prev) => prev.filter((t) => t !== name.toUpperCase()));
        return data.result || "Done.";
      } catch (err) {
        setActiveTools((prev) => prev.filter((t) => t !== name.toUpperCase()));
        return `PC control error: ${err.message}`;
      }
    }

    setActiveTools((prev) => prev.filter((t) => t !== name.toUpperCase()));
    return null;
  };

  const handleStop = () => {
    ttsRef.current.stop();
    setStatus('monitoring');
  };

  useEffect(() => {
    if (status === 'monitoring') {
      stt.startMonitoring();
      sttActiveRef.current = false;
    } else if (status === 'listening' && !sttActiveRef.current) {
      sttActiveRef.current = true;
      stt.startListening();
    } else if (status !== 'monitoring' && status !== 'listening') {
      stt.stop();
      sttActiveRef.current = false;
    }
  }, [status]);

  useEffect(() => {
    if (status === 'error') {
      const t = setTimeout(() => { setStatus('monitoring'); setErrorMsg(''); }, 4000);
      return () => clearTimeout(t);
    }
  }, [status]);

  const manualTrigger = () => {
    if (status === 'listening' || status === 'thinking' || status === 'speaking') return;
    ttsRef.current.stop();
    sttActiveRef.current = false;
    getAudioCtx();
    playBeep('activation');
    setInterimText('');
    setStatus('listening');
    sttRef.current.startListening();
  };

  const sendText = () => {
    const trimmed = textInput.trim();
    if (!trimmed) return;
    ttsRef.current.stop();
    sttRef.current.stop();
    sttActiveRef.current = false;
    detectEmotion(trimmed);
    callAI(trimmed);
    setTextInput('');
  };

  const clearMemory = () => {
    setConfirmationToast({
      tier: 'moderate',
      message: 'Clear all memory?',
      action: 'This will delete all pinned memories and conversation history.',
    });
  };

  const systemStatus = {
    stt: status === 'error' ? 'error' : 'online',
    llm: status === 'thinking' ? 'loading' : status === 'error' ? 'error' : 'online',
    tts: status === 'speaking' ? 'online' : 'ready',
    memory: memoryCount > 0 ? 'online' : 'loading',
    pcControl,
    pcDangerous: dangerousTier,
    web: 'online',
  };

  const borderColor = EMOTION_COLORS[emotion] || EMOTION_COLORS.neutral;

  return (
    <div
      className="h-screen w-screen overflow-hidden flex flex-row font-rajdhani"
      style={{
        background: '#000',
        color: '#e0f7ff',
        minWidth: 1200,
        fontFamily: 'Rajdhani, sans-serif',
      }}
    >
      <BackgroundLayers />

      {errorMsg && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-black/90 border border-red-500/50 rounded-lg backdrop-blur-sm"
          style={{ boxShadow: '0 0 30px rgba(239,68,68,0.3)' }}
        >
          <span className="text-red-400 text-sm font-mono">{errorMsg}</span>
        </div>
      )}

      <div
        className="absolute inset-0 pointer-events-none z-30"
        style={{
          boxShadow: `inset 0 0 60px ${borderColor}15`,
          border: `1px solid ${borderColor}20`,
        }}
      />
      <div
        className="absolute top-0 left-0 right-0 h-0.5 pointer-events-none z-40"
        style={{ background: `linear-gradient(90deg, transparent, ${borderColor}60, transparent)` }}
      />

      <LeftPanel
        systemStatus={systemStatus}
        memoryCount={memoryCount}
        pinnedMemories={pinnedMemories}
        activeTools={activeTools}
        onSettingsClick={() => setShowSettings(true)}
      />

      <CenterPanel
        status={status}
        interimText={interimText}
        messages={messages.filter((m) => m.role !== 'system')}
        analyser={analyserRef.current}
        onManualTrigger={manualTrigger}
        emotion={emotion}
        taskProgress={activeTask?.progress}
      />

      <RightPanel
        weather={weather}
        spotify={spotify}
        tasks={tasks}
      />

      {activeTask && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40"
          style={{ width: 500 }}
        >
          <TaskHUD task={activeTask} onAbort={abortTask} />
        </div>
      )}

      <SettingsDrawer
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        apiKey={apiKey}
        setApiKey={setApiKey}
        wakeWord={wakeWord}
        setWakeWord={setWakeWord}
        locationLat={locationLat}
        setLocationLat={setLocationLat}
        locationLon={locationLon}
        setLocationLon={setLocationLon}
        podcastUri={podcastUri}
        setPodcastUri={setPodcastUri}
        pcControl={pcControl}
        setPcControl={setPcControl}
        dangerousTier={dangerousTier}
        setDangerousTier={setDangerousTier}
        proactiveSuggestions={proactiveSuggestions}
        setProactiveSuggestions={setProactiveSuggestions}
        onClearMemory={clearMemory}
      />

      <ConfirmationToast
        toast={confirmationToast}
        isSpeaking={status === 'speaking'}
        onConfirm={async () => {
          if (confirmationToast?.confirm_id) {
            try {
              const res = await fetch(`${TTS_URL}/pc/confirm/${confirmationToast.confirm_id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              });
              const data = await res.json();
              if (data.result) {
                setStatus('speaking');
                tts.speak(data.result, {
                  onEnd: () => setStatus('monitoring'),
                  onError: () => setStatus('error'),
                });
              }
            } catch (err) {
              setErrorMsg('Confirmation failed');
            }
          }
          setConfirmationToast(null);
        }}
        onCancel={async () => {
          if (confirmationToast?.confirm_id) {
            try {
              await fetch(`${TTS_URL}/pc/confirm/${confirmationToast.confirm_id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
              });
            } catch (_) {}
          }
          setConfirmationToast(null);
        }}
      />

      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-40"
        style={{ width: 400 }}
      >
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') sendText(); }}
          placeholder="Type command..."
          style={{
            flex: 1,
            padding: '10px 16px',
            background: 'rgba(0, 212, 255, 0.05)',
            border: `1px solid ${borderColor}40`,
            borderRadius: 4,
            color: '#e0f7ff',
            fontSize: 13,
            fontFamily: 'Rajdhani, sans-serif',
          }}
        />
        <button
          onClick={sendText}
          disabled={!textInput.trim()}
          className="px-6 py-2 text-xs font-bold cursor-pointer transition-all hover:bg-cyan-500/20 disabled:opacity-30"
          style={{
            background: borderColor,
            border: 'none',
            borderRadius: 4,
            color: '#000',
            fontFamily: 'Orbitron, sans-serif',
            letterSpacing: '0.1em',
          }}
        >
          SEND
        </button>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400&family=Orbitron:wght@400;700&family=Rajdhani:wght@300;400;500;600;700&display=swap');

        * {
          box-sizing: border-box;
        }

        ::-webkit-scrollbar {
          width: 4px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(0, 212, 255, 0.05);
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(0, 212, 255, 0.3);
          border-radius: 2px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 212, 255, 0.5);
        }

        ::selection {
          background: rgba(0, 212, 255, 0.3);
          color: #e0f7ff;
        }
      `}</style>
    </div>
  );
}
