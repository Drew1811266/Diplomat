import i18next from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: {
    translation: {
      "app.name": "Diplomat"
    }
  },
  zh: {
    translation: {
      "app.name": "Diplomat"
    }
  }
};

export const appI18n = i18next.createInstance();

void appI18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false
  }
});
