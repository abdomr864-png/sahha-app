import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DevSettings, I18nManager } from 'react-native';
import * as Localization from 'expo-localization';
import en from '@locales/en.json';
import fr from '@locales/fr.json';
import ar from '@locales/ar.json';
import { storage } from '@lib/offline';

export type AppLocale = 'en' | 'fr' | 'ar';
export const SUPPORTED_LOCALES: AppLocale[] = ['en', 'fr', 'ar'];
const LOCALE_KEY = 'sahha.locale.v1';
const RTL_FLAG_KEY = 'sahha.rtlApplied.v1';

export function detectInitialLocale(): AppLocale {
  const saved = storage.getString(LOCALE_KEY) as AppLocale | undefined;
  if (saved && SUPPORTED_LOCALES.includes(saved)) return saved;
  const device = Localization.getLocales()[0]?.languageCode;
  if (device === 'fr' || device === 'ar' || device === 'en') return device;
  return 'en';
}

let initialized = false;

export function initI18n(): typeof i18n {
  if (initialized) return i18n;
  initialized = true;
  const lng = detectInitialLocale();
  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      ar: { translation: ar },
    },
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  applyRtlForLocale(lng, { silent: true });
  return i18n;
}

/**
 * Persist a new locale and toggle RTL if needed. Returns true when an
 * `I18nManager.forceRTL` flip happened — when that occurs we auto-reload
 * so the new layout direction takes effect (otherwise buttons / paddings
 * stay mirrored until the next manual restart).
 */
export function setLocale(next: AppLocale): { rtlChanged: boolean } {
  storage.setString(LOCALE_KEY, next);
  void i18n.changeLanguage(next);
  const result = applyRtlForLocale(next, { silent: false });
  if (result.rtlChanged) {
    // Defer slightly so any in-flight UI update (alert/spinner) renders
    // before the JS bundle reloads.
    setTimeout(() => triggerAppReload(), 200);
  }
  return result;
}

/**
 * Force a full app reload. Tries expo-updates first (works in dev clients
 * and production), falls back to DevSettings (Expo Go / dev mode).
 */
function triggerAppReload(): void {
  try {
    const Updates = require('expo-updates');
    if (Updates && typeof Updates.reloadAsync === 'function') {
      void Updates.reloadAsync();
      return;
    }
  } catch {
    /* expo-updates not installed — fall through */
  }
  if (DevSettings && typeof DevSettings.reload === 'function') {
    try {
      DevSettings.reload();
      return;
    } catch {
      /* not available — last resort below */
    }
  }
  // Last resort: nothing we can do programmatically. Locale and RTL flag
  // are already persisted, so the change applies on the next manual launch.
}

function applyRtlForLocale(
  locale: AppLocale,
  { silent }: { silent: boolean },
): { rtlChanged: boolean } {
  const wantRtl = locale === 'ar';
  const isRtl = I18nManager.isRTL;
  if (wantRtl === isRtl) return { rtlChanged: false };
  I18nManager.allowRTL(wantRtl);
  I18nManager.forceRTL(wantRtl);
  storage.setString(RTL_FLAG_KEY, wantRtl ? '1' : '0');
  if (silent) return { rtlChanged: false };
  return { rtlChanged: true };
}

export { i18n };
