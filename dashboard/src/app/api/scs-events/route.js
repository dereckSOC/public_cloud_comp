import { NextResponse } from "next/server";

const FALLBACK_EVENTS = [
  {
    title: "Relay For Life 2026",
    url: "https://www.scsrelayforlife.sg/",
    tag: "Upcoming",
  },
  {
    title: "Race Against Cancer 2026",
    url: "https://www.singaporecancersociety.org.sg/rac.html",
    tag: "Coming Soon",
  },
];

const FETCH_TIMEOUT_MS = 10_000;

export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch("https://www.singaporecancersociety.org.sg", {
      next: { revalidate: 86400 },
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json({ events: FALLBACK_EVENTS, source: "fallback" });
    }

    const html = await res.text();

    const events = [];

    // Try to find Relay For Life info
    const relayMatch = html.match(
      /Relay\s+For\s+Life[^<]*(?:<[^>]*>)*[^<]*(\d{1,2}\s*[-–]\s*\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{1,2}\s*[-–]\s*\d{1,2},?\s*\d{4})?/i
    );
    const relayLinkMatch = html.match(
      /href=["']([^"']*(?:relayforlife|relay-for-life)[^"']*)["']/i
    );

    events.push({
      title: "Relay For Life 2026",
      url: relayLinkMatch?.[1] || "https://www.scsrelayforlife.sg/",
      tag: "Upcoming",
    });

    // Try to find Race Against Cancer info
    const racMatch = html.match(
      /Race\s+Against\s+Cancer[^<]*(?:<[^>]*>)*[^<]*(\d{1,2}\s*[-–]\s*\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{1,2}\s*[-–]\s*\d{1,2},?\s*\d{4})?/i
    );
    const racLinkMatch = html.match(
      /href=["']([^"']*(?:raceagainstcancer|race-against-cancer|rac\.html)[^"']*)["']/i
    );

    events.push({
      title: "Race Against Cancer 2026",
      url: racLinkMatch?.[1] || "https://www.singaporecancersociety.org.sg/rac.html",
      tag: "Coming Soon",
    });

    return NextResponse.json({ events, source: "scraped" });
  } catch {
    return NextResponse.json({ events: FALLBACK_EVENTS, source: "fallback" });
  }
}
