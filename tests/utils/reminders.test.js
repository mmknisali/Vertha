import { describe, it, expect, vi } from 'vitest';
import {
  REMINDER_TOOLS,
  REMINDER_TOOL_NAMES,
  runReminderTool,
  reminderAlertText,
} from '../../src/utils/reminders.js';

const BASE = 'http://localhost:8766';

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

describe('reminder tool definitions', () => {
  it('declares add, list and complete for the model', () => {
    expect(REMINDER_TOOL_NAMES).toEqual(['add_reminder', 'list_reminders', 'complete_reminder']);
    const add = REMINDER_TOOLS.find((t) => t.function.name === 'add_reminder');
    expect(add.function.parameters.required).toEqual(['text', 'due']);
    const done = REMINDER_TOOLS.find((t) => t.function.name === 'complete_reminder');
    expect(done.function.parameters.required).toEqual(['id']);
  });
});

describe('runReminderTool', () => {
  it('adds a reminder and confirms it with the due time', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {
      id: 1, text: 'call mum', due_at: '2026-11-11T15:30:00Z',
    }));
    const reply = await runReminderTool(BASE, 'add_reminder', { text: 'call mum', due: 'in 30 minutes' }, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(`${BASE}/reminders`, expect.objectContaining({ method: 'POST' }));
    const sent = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(sent).toEqual({ text: 'call mum', due: 'in 30 minutes' });
    expect(reply).toMatch(/^Reminder set for .+, sir: call mum\.$/);
  });

  it('passes on the server reason when a due time cannot be read', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(400, { detail: 'I could not read the due time "soon".' }));
    const reply = await runReminderTool(BASE, 'add_reminder', { text: 'x', due: 'soon' }, fetchImpl);
    expect(reply).toBe("I couldn't set that reminder, sir. I could not read the due time \"soon\".");
  });

  it('says so when nothing is open', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { reminders: [] }));
    expect(await runReminderTool(BASE, 'list_reminders', {}, fetchImpl)).toBe('Nothing on your reminder list, sir.');
  });

  it('reads open reminders back in order', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, {
      reminders: [
        { id: 1, text: 'stretch', due_at: '2026-11-11T10:00:00Z' },
        { id: 2, text: 'bins', due_at: '2026-11-11T12:00:00Z' },
      ],
    }));
    const reply = await runReminderTool(BASE, 'list_reminders', {}, fetchImpl);
    expect(reply.startsWith('stretch, at ')).toBe(true);
    expect(reply).toContain('. bins, at ');
    expect(reply.endsWith('.')).toBe(true);
  });

  it('marks a reminder done by id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { id: 3, done: true }));
    expect(await runReminderTool(BASE, 'complete_reminder', { id: 3 }, fetchImpl)).toBe('Done, sir.');
    expect(fetchImpl).toHaveBeenCalledWith(`${BASE}/reminders/3/done`, expect.objectContaining({ method: 'POST' }));
  });

  it('handles an unknown id and an already-done reminder', async () => {
    const notFound = vi.fn().mockResolvedValue(jsonResponse(404, { detail: 'No reminder' }));
    expect(await runReminderTool(BASE, 'complete_reminder', { id: 99 }, notFound)).toBe("I can't find reminder 99, sir.");
    const already = vi.fn().mockResolvedValue(jsonResponse(409, { detail: 'done' }));
    expect(await runReminderTool(BASE, 'complete_reminder', { id: 3 }, already)).toBe("That one's already done, sir.");
  });

  it('answers in words when the server cannot be reached', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await runReminderTool(BASE, 'list_reminders', {}, fetchImpl)).toBe("I couldn't reach your reminders just now, sir.");
  });
});

describe('reminderAlertText', () => {
  it('words a due reminder for the screen and the voice', () => {
    expect(reminderAlertText({ id: 1, text: 'take the bins out' })).toBe('Reminder, sir: take the bins out.');
  });
});
