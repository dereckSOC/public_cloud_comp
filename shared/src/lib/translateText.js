export async function translateText(text, targetLang) {
  if (targetLang === "en") return text;

  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, targetLang }),
    });

    if (!response.ok) return text;

    const data = await response.json();
    return data.translatedText ?? text;
  } catch {
    return text;
  }
}

export function formatSupabaseError(error) {
  if (!error) return "";
  const parts = [error.message, error.details, error.hint, error.code].filter(Boolean);
  if (parts.length > 0) return parts.join(" | ");
  try {
    return JSON.stringify(error, Object.getOwnPropertyNames(error));
  } catch {
    return String(error);
  }
}
