"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import useQueryParams from "@psd/shared/lib/useQueryParams";
import AudioToggleButton from "@psd/shared/components/AudioToggleButton";
import useLoopingAudio from "@psd/shared/lib/useLoopingAudio";

const BACKGROUND_THEME_SOUND_PATH = "/images/background-theme.mp3";

const PLATFORM_ICONS = {
  website: {
    bg: "bg-cyan-600",
    icon: (
      <span className="text-4xl leading-none">🌐</span>
    ),
  },
  instagram: {
    bg: "bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]",
    icon: (
      <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  tiktok: {
    bg: "bg-black",
    icon: (
      <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
  },
  facebook: {
    bg: "bg-[#1877F2]",
    icon: (
      <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  youtube: {
    bg: "bg-red-600",
    icon: (
      <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6">
        <path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
      </svg>
    ),
  },
  twitter: {
    bg: "bg-black",
    icon: (
      <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
};

function getPlatformIcon(title) {
  const key = title.toLowerCase().replace(/[^a-z]/g, "");
  // handle "x" as twitter
  if (key === "x") return PLATFORM_ICONS.twitter;
  return PLATFORM_ICONS[key] ?? null;
}

function isSocialMediaSection(section) {
  return section.title.toLowerCase().includes("social media");
}

export default function SocialClient() {
  const { buildQueryString } = useQueryParams();
  const queryString = buildQueryString();

  useLoopingAudio(BACKGROUND_THEME_SOUND_PATH, { volume: 0.35 });

  const [sections, setSections] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    async function fetchSocialData() {
      setEventsLoading(true);
      const [sectionsRes, itemsRes] = await Promise.all([
        fetch("/api/social/sections"),
        fetch("/api/social/items"),
      ]);

      const sectionsBody = await sectionsRes.json();
      const itemsBody = await itemsRes.json();

      if (!sectionsRes.ok) console.error("Sections error:", sectionsBody?.error || "Could not load sections.");
      if (!itemsRes.ok) console.error("Items error:", itemsBody?.error || "Could not load items.");

      const items = itemsBody.items ?? [];
      setSections((sectionsBody.sections ?? []).map(s => ({
        ...s,
        items: items.filter(i => i.section_id === s.id),
      })));
      setEventsLoading(false);
    }
    fetchSocialData();
  }, []);

  return (
    <div className="flex flex-col justify-center items-center min-h-screen gap-6 py-8 pb-24 px-4 bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
      <div className="w-full max-w-lg flex justify-between items-center gap-4">
        <Link
          href={`/questlistpage${queryString}`}
          className="bg-indigo-700 text-yellow-300 border-2 border-indigo-500 px-6 py-3 rounded-lg shadow-lg hover:bg-indigo-600 transition-colors text-base font-bold font-silkscreen"
        >
          Home
        </Link>
        <AudioToggleButton className="inline-flex items-center justify-center bg-stone-800/90 hover:bg-stone-700 text-stone-100 rounded-sm border-2 border-stone-950 shadow-lg transition-all h-12 w-12" />
      </div>

      <div>
        <h1 className="text-4xl font-bold mb-1 text-center text-yellow-300 font-silkscreen">
          Social
        </h1>
        <p className="text-purple-200 text-center text-sm font-silkscreen">
          Singapore Cancer Society
        </p>
      </div>

      {eventsLoading ? (
        <p className="text-purple-300 text-sm text-center py-4 font-silkscreen">
          Loading...
        </p>
      ) : (
        sections.map((section) => (
          <div key={section.id} className="bg-indigo-800/60 border-2 border-indigo-500 p-6 rounded-lg shadow-lg w-full max-w-lg">
            <h2 className="text-2xl font-bold text-yellow-300 font-silkscreen mb-4 text-center">
              {section.title}
            </h2>

            {section.items.length === 0 ? (
              <p className="text-purple-300 text-sm text-center py-4 font-silkscreen">
                No items yet.
              </p>
            ) : isSocialMediaSection(section) ? (
              /* Icon grid layout for social media sections */
              <div className="flex justify-center items-center gap-4 flex-wrap">
                {section.items.map((item) => {
                  const platform = getPlatformIcon(item.title);
                  return (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1 group"
                      title={item.title}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg ${platform ? platform.bg : "bg-indigo-600"}`}>
                        {platform ? platform.icon : (
                          <span className="text-white text-lg font-bold font-silkscreen">
                            {item.title.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="text-purple-200 text-[10px] group-hover:text-yellow-300 transition-colors font-silkscreen">
                        {item.title}
                      </span>
                    </a>
                  );
                })}
              </div>
            ) : (
              /* Card list layout for all other sections */
              <div className="flex flex-col gap-4">
                {section.items.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-indigo-900/60 border border-indigo-400 rounded-lg p-4 hover:bg-indigo-600/60 transition-colors group"
                  >
                    <h3 className="text-yellow-200 font-bold text-base group-hover:text-yellow-300 transition-colors font-silkscreen">
                      {item.title}
                    </h3>
                    {item.detail && (
                      <p className="text-purple-300 text-sm font-silkscreen mt-1">{item.detail}</p>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
