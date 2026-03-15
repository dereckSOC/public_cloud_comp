"use client";

import i18n from "i18next";
import { usePathname, useRouter } from "next/navigation";
import useQueryParams from "../lib/useQueryParams";

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { buildQueryString } = useQueryParams();
  const current = i18n.resolvedLanguage || i18n.language;

  return (
    <select
      value={current}
      onChange={(e) => {
        const nextLang = e.target.value;
        i18n.changeLanguage(nextLang);
        const qs = buildQueryString({ lang: nextLang });
        router.replace(`${pathname}${qs}`);
      }}
      className="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm shadow">
      <option value="en">English</option>
      <option value="zh-CN">中文（简体）</option>
      <option value="ms">Bahasa Melayu</option>
      <option value="ta">தமிழ்</option>
    </select>
  );
}