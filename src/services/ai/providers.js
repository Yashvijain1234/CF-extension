/**
 * Pluggable LLM provider layer.
 *
 * Each provider implements a single `complete()` method. Adding a new backend
 * is as simple as registering another entry in {@link PROVIDERS}. All network
 * calls happen from the background worker.
 */

const openai = {
  async complete(settings, { system, prompt }) {
    const base = settings.baseUrl || 'https://api.openai.com/v1';
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message ?? 'OpenAI request failed');
    return data.choices?.[0]?.message?.content ?? '';
  },
};

const anthropic = {
  async complete(settings, { system, prompt }) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey ?? '',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: settings.model || 'claude-3-5-sonnet-latest',
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message ?? 'Anthropic request failed');
    return data.content?.[0]?.text ?? '';
  },
};

const gemini = {
  async complete(settings, { system, prompt }) {
    const model = settings.model || 'gemini-1.5-flash';
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }),
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message ?? 'Gemini request failed');
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  },
};

// `custom` reuses the OpenAI-compatible schema against a user-supplied baseUrl.
const custom = openai;

export const PROVIDERS = {
  openai,
  anthropic,
  gemini,
  custom,
};

export async function runCompletion(settings, input) {
  if (settings.provider === 'none') {
    throw new Error('No AI provider configured. Add one in Settings → AI.');
  }
  if (!settings.apiKey && settings.provider !== 'custom') {
    throw new Error('Missing API key. Add it in Settings → AI.');
  }
  const adapter = PROVIDERS[settings.provider];
  if (!adapter) throw new Error(`Unknown AI provider: ${settings.provider}`);
  return adapter.complete(settings, input);
}
