import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { I18nManager } from "react-native";
import ar from "./ar.json";

if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  lng: "ar",
  fallbackLng: "ar",
  resources: { ar: { translation: ar } },
  interpolation: { escapeValue: false },
});

export default i18n;
