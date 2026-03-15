'use client'

import { useTranslation } from "react-i18next";

export default function Circle({
  size = 300,
  textKey = "home.ready"
}) {
  const { t } = useTranslation();

  return (
    <div
      className="rounded-full flex items-center justify-center text-center text-4xl font-black text-white bg-yellow-600 tracking-wider animate-float font-silkscreen"
      style={{
        width: size,
        height: size,
      }}
    >
      {t(textKey)}
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
