import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "../i18n/en";
import { zh } from "../i18n/zh";

export type AppLanguage = "en" | "zh";

export const appI18n = i18next.createInstance();

void appI18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh }
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false
  }
});
