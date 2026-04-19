import Image from "next/image";

const THEMES = {
  light: {
    shell: "border border-[#d6bd7d] bg-white/95 shadow-sm",
    label: "text-[#7A2F38]/80",
  },
  dark: {
    shell: "border border-[#d6bd7d]/50 bg-black/35 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-sm",
    label: "text-[#f6e7b1]",
  },
};

export default function SupportedByBadge({
  logoSrc,
  alt = "World Gold Council logo",
  tone = "light",
  className = "",
}) {
  const theme = THEMES[tone] ?? THEMES.light;

  return (
    <div
      className={`inline-flex flex-col items-center gap-2 rounded-2xl px-4 py-3 ${theme.shell} ${className}`.trim()}
    >
      <span className={`text-[0.65rem] font-semibold uppercase tracking-[0.28em] ${theme.label}`}>
        Supported by
      </span>
      <div className="relative h-10 w-[170px] sm:h-12 sm:w-[220px]">
        <Image
          src={logoSrc}
          alt={alt}
          fill
          sizes="(max-width: 640px) 170px, 220px"
          className="object-contain"
          unoptimized
        />
      </div>
    </div>
  );
}
