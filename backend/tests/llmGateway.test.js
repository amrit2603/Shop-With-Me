import { describe, expect, it, vi } from 'vitest';
const { generateJson, SUMMARY_SCHEMA } = require('../src/services/llmGateway.js');
const { generateAiSummary } = require('../src/services/aiSummary.js');

const valid = { paragraph: 'Option one has the strongest support.', topReasons: ['Color'] };

describe('optional Ollama JSON gateway', () => {
  it('parses and validates a successful structured response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: JSON.stringify(valid) }) });
    await expect(generateJson('structured input', SUMMARY_SCHEMA, { url: 'http://localhost:11434', fetchImpl })).resolves.toEqual(valid);
    expect(fetchImpl.mock.calls[0][1].signal).toBeDefined();
  });

  it('times out when the local model does not respond', async () => {
    const fetchImpl = vi.fn(() => new Promise(() => {}));
    await expect(generateJson('input', SUMMARY_SCHEMA, { url: 'http://localhost:11434', fetchImpl, timeoutMs: 5 })).rejects.toThrow(/timed out/i);
  });

  it('rejects invalid JSON and schema violations', async () => {
    const invalidJson = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: 'not json' }) });
    await expect(generateJson('input', SUMMARY_SCHEMA, { url: 'http://localhost:11434', fetchImpl: invalidJson })).rejects.toThrow();
    const invalidShape = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: JSON.stringify({ ...valid, price: 9 }) }) });
    await expect(generateJson('input', SUMMARY_SCHEMA, { url: 'http://localhost:11434', fetchImpl: invalidShape })).rejects.toThrow(/unexpected property/i);
  });

  it('falls back without making a request when AI is not configured', async () => {
    const configured = process.env.OLLAMA_URL;
    delete process.env.OLLAMA_URL;
    try {
      await expect(generateAiSummary({ comments: {} }, { rankings: [] })).resolves.toBeNull();
    } finally {
      if (configured) process.env.OLLAMA_URL = configured;
    }
  });

  it('sends only vote counts and comments to the optional summary gateway and falls back on timeout', async () => {
    const prior = process.env.OLLAMA_URL;
    process.env.OLLAMA_URL = 'http://localhost:11434';
    const room = { comments: { 'secret-product-id': [{ text: 'I like the color.' }] } };
    const summary = {
      totalParticipants: 4,
      rankings: [{ product: { id: 'secret-product-id', name: 'Hidden Product', price: 900 }, breakdown: { Love: 3, Like: 1, No: 0, 'Need more info': 0 } }],
    };
    try {
      const gateway = vi.fn().mockResolvedValue(valid);
      await expect(generateAiSummary(room, summary, gateway)).resolves.toMatchObject({ label: 'AI-generated summary', paragraph: valid.paragraph });
      expect(gateway.mock.calls[0][0]).toContain('I like the color.');
      expect(gateway.mock.calls[0][0]).not.toContain('secret-product-id');
      expect(gateway.mock.calls[0][0]).not.toContain('Hidden Product');
      expect(gateway.mock.calls[0][0]).not.toContain('900');
      await expect(generateAiSummary(room, summary, vi.fn().mockRejectedValue(new Error('timeout')))).resolves.toBeNull();
    } finally {
      if (prior) process.env.OLLAMA_URL = prior;
      else delete process.env.OLLAMA_URL;
    }
  });
});
