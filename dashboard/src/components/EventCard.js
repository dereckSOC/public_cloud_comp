"use client";
export default function SocialCard({ title, links, icon }) {
  return (
    <div className="bg-indigo-800/60 border-2 border-indigo-500 p-6 rounded-lg shadow-lg w-full max-w-lg hover:bg-indigo-700/60 transition-colors">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{icon}</span>
        <h2
          className="text-2xl font-bold text-yellow-300 font-silkscreen"
        >
          {title}
        </h2>
      </div>
      <div className="flex flex-col gap-3">
        {links.map((link, index) => (
          <a
            key={index}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-indigo-900/60 border border-indigo-400 rounded-lg px-4 py-3 hover:bg-indigo-600/60 transition-colors group"
          >
            <span className="text-lg">{link.icon}</span>
            <div className="flex flex-col">
              <span
                className="text-yellow-200 font-bold text-sm group-hover:text-yellow-300 transition-colors font-silkscreen"
              >
                {link.label}
              </span>
              {link.detail && (
                <span
                  className="text-purple-300 text-xs mt-0.5 font-silkscreen"
                >
                  {link.detail}
                </span>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
