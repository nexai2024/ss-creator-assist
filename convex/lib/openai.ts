const DEFAULT_CHAT_MODEL = "gpt-4o-mini";
const DEFAULT_EMBED_MODEL = "text-embedding-3-small";

function openaiUrl(path: string): string {
  const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  return `${base}${path}`;
}

function openaiKey(): string | null {
  return process.env.OPENAI_API_KEY ?? null;
}

export function hasOpenAiKey(): boolean {
  return Boolean(openaiKey());
}

export async function embedText(text: string): Promise<number[] | null> {
  const key = openaiKey();
  if (!key) return null;
  const input = text.replace(/\s+/g, " ").trim().slice(0, 8000);
  if (!input) return null;
  const res = await fetch(openaiUrl("/embeddings"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_EMBED_MODEL ?? DEFAULT_EMBED_MODEL,
      input,
    }),
  });
  if (!res.ok) {
    console.error("OpenAI embeddings failed", res.status, await res.text());
    return null;
  }
  const data = await res.json() as { data?: Array<{ embedding?: number[] }> };
  const embedding = data.data?.[0]?.embedding;
  return embedding && embedding.length === 1536 ? embedding : null;
}

export async function chatComplete(system: string, user: string): Promise<string | null> {
  const key = openaiKey();
  if (!key) return null;
  const res = await fetch(openaiUrl("/chat/completions"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_CHAT_MODEL ?? DEFAULT_CHAT_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    console.error("OpenAI chat failed", res.status, await res.text());
    return null;
  }
  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  return content || null;
}
