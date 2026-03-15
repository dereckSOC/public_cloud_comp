import { NextResponse } from "next/server";

export async function POST(request) {
  const { text, targetLang } = await request.json();

  if (!text || targetLang === "en") {
    return NextResponse.json({ translatedText: text });
  }

  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ translatedText: text });
  }

  try {
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, source: "en", target: targetLang, format: "text" }),
      }
    );

    if (!response.ok) {
      return NextResponse.json({ translatedText: text });
    }

    const data = await response.json();
    return NextResponse.json({ translatedText: data.data.translations[0].translatedText });
  } catch {
    return NextResponse.json({ translatedText: text });
  }
}
