/**
 * correctLocationSpelling — normalise a raw user-entered place name.
 *
 * Attempts to use the Replit AI utility if available; falls back to a
 * deterministic title-case transform on any error or empty response.
 */

function toTitleCase(str: string): string {
  return str
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export async function correctLocationSpelling(raw: string): Promise<string> {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — optional Replit-only package; handled at runtime
    const { Ai } = await import("@replit/ai-modelfarm-node").catch(() => ({ Ai: null }));
    if (!Ai) return toTitleCase(trimmed);

    const ai = new Ai();
    const prompt = `Return ONLY the correctly spelled, title-cased official place name for: "${trimmed}". No explanation, no punctuation, just the name.`;
    const result = await ai.complete({ model: "text-bison@001", prompt, maxOutputTokens: 32 });
    const text = (result.completion ?? "").trim().replace(/^["']|["']$/g, "").trim();
    if (text && text.length > 0 && text.length < 100) return text;
    return toTitleCase(trimmed);
  } catch {
    return toTitleCase(trimmed);
  }
}
