"use client";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function Button({ text, textKey, link = "" }) {
  const { t } = useTranslation();
  const label = textKey ? t(textKey) : (text ?? "Login");

  return (
    <Link href={link}>
      <button
        className="px-6 py-3 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 transition font-silkscreen"
        type="button">
        {label}
      </button>
    </Link>
  );
}