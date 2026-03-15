import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";
import ms from "./locales/ms.json";
import ta from "./locales/ta.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: ["en", "zh-CN", "ms", "ta"],
    interpolation: { escapeValue: false },
    resources: {
      en: { translation: en },
      "zh-CN": { translation: zhCN },
      ms: { translation: ms },
      ta: { translation: ta },
    },
  });

export default i18n;
