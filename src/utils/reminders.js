// Reminder tools: the function definitions the model sees, the calls they make
// to the reminders API, and the spoken/visible text that comes back.

export const REMINDER_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_reminder',
      description: 'Set a reminder for the user. Use when they ask to be reminded of something.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'What to remind them of' },
          due: { type: 'string', description: 'When: "in 30 minutes", "in 2 hours", "in 1 day", or a local time as ISO 8601 such as 2026-11-11T18:00' },
        },
        required: ['text', 'due'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_reminders',
      description: "List the user's open reminders, soonest first.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_reminder',
      description: 'Mark a reminder as done by its id.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'integer', description: 'Reminder id from list_reminders' } },
        required: ['id'],
      },
    },
  },
];

export const REMINDER_TOOL_NAMES = REMINDER_TOOLS.map((t) => t.function.name);

const clock = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

async function errorDetail(res) {
  try {
    const body = await res.json();
    return typeof body?.detail === 'string' ? body.detail : '';
  } catch (_) {
    return '';
  }
}

// Runs one reminder tool call against the TTS server and returns the words to show.
export async function runReminderTool(baseUrl, name, args = {}, fetchImpl = (...a) => fetch(...a)) {
  try {
    if (name === 'add_reminder') {
      const res = await fetchImpl(`${baseUrl}/reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: args.text, due: args.due }),
      });
      if (!res.ok) return `I couldn't set that reminder, sir. ${await errorDetail(res)}`.trim();
      const data = await res.json();
      return `Reminder set for ${clock(data.due_at)}, sir: ${data.text}.`;
    }

    if (name === 'list_reminders') {
      const res = await fetchImpl(`${baseUrl}/reminders`);
      if (!res.ok) return "I couldn't read your reminders, sir.";
      const { reminders = [] } = await res.json();
      if (!reminders.length) return 'Nothing on your reminder list, sir.';
      return reminders.map((r) => `${r.text}, at ${clock(r.due_at)}`).join('. ') + '.';
    }

    if (name === 'complete_reminder') {
      const res = await fetchImpl(`${baseUrl}/reminders/${encodeURIComponent(args.id)}/done`, { method: 'POST' });
      if (res.status === 404) return `I can't find reminder ${args.id}, sir.`;
      if (res.status === 409) return "That one's already done, sir.";
      if (!res.ok) return "I couldn't mark that done, sir.";
      return 'Done, sir.';
    }
  } catch (_) {
    return "I couldn't reach your reminders just now, sir.";
  }
  return `Unknown reminder request: ${name}`;
}

// The line shown and spoken when a reminder falls due.
export const reminderAlertText = (data) => `Reminder, sir: ${data?.text ?? ''}.`;
