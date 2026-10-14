import type { LocaleCode } from "../../locales";
import type { Widen } from "../_shared";

// Spanish is the source of truth; every other locale is checked against
// its widened shape, so missing/extra keys per screen surface as TS errors.
const es = {
  "couldNotAuthenticate": "No se pudo autenticar"
} as const;

export type AuthMessages = Widen<typeof es>;

export const auth: Record<LocaleCode, AuthMessages> = {
  es,
  en: {
    "couldNotAuthenticate": "Could not authenticate"
  },
  fr: {
    "couldNotAuthenticate": "Impossible de s'authentifier"
  },
  pt: {
    "couldNotAuthenticate": "Não foi possível autenticar"
  },
  it: {
    "couldNotAuthenticate": "Autenticazione non riuscita"
  },
  ru: {
    "couldNotAuthenticate": "Не удалось пройти аутентификацию"
  },
  zh: {
    "couldNotAuthenticate": "身份验证失败"
  },
  ko: {
    "couldNotAuthenticate": "인증하지 못했습니다"
  },
  ja: {
    "couldNotAuthenticate": "認証できませんでした"
  },
  hi: {
    "couldNotAuthenticate": "प्रमाणीकरण नहीं हो सका"
  },
  ar: {
    "couldNotAuthenticate": "تعذرت المصادقة"
  },
};
