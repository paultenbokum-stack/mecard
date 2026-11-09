import "server-only";

// The company name, when nothing on the website matches its domain (an
// abbreviated domain, a title that's only a tagline). One small Gemini call, the
// same provider GuestWave uses, called directly without a library. Skipped when
// GEMINI_API_KEY isn't set: the admin then checks the name we guessed.

const MODEL = () => process.env.GEMINI_NAME_MODEL || "gemini-3.1-flash-lite";

export const aiNameConfigured = () => !!process.env.GEMINI_API_KEY;

/** The trading name from the page's texts, or "" when the model isn't sure or names something not on the page. */
export async function aiCompanyName(website: string, hints: string[]): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !hints.length) return "";
  const prompt = [
    "You name the company that owns a website, for its staff's digital business cards.",
    `Website: ${website}`,
    "Texts from its home page (title, headings, logo text, copyright line):",
    ...hints.map((h) => `- ${h.slice(0, 200)}`),
    'Reply as JSON: {"name": "..."}. Use the company\'s trading name as it is written in the texts, without "Home", taglines or "(Pty) Ltd". Use an empty name if the texts don\'t show it.',
  ].join("\n");
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: 200 },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error(`[ai-name] HTTP ${res.status}`, (await res.text().catch(() => "")).slice(0, 300));
      return "";
    }
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const name = String((JSON.parse(text) as { name?: unknown }).name ?? "").trim().slice(0, 120);
    return nameOnPage(name, hints) ? name : "";
  } catch (e) {
    console.error("[ai-name]", e instanceof Error ? e.message : e);
    return "";
  }
}

/** Only a name that appears in the texts, so the model can't invent one. */
export function nameOnPage(name: string, hints: string[]): boolean {
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const n = squash(name);
  return n.length >= 2 && hints.some((h) => squash(h).includes(n));
}
