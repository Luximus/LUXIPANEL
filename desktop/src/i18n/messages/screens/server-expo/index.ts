import type { LocaleCode } from "../../../locales";
import { es } from "./es";
import { en } from "./en";
import { fr } from "./fr";
import { pt } from "./pt";
import { it } from "./it";
import { ru } from "./ru";
import { zh } from "./zh";
import { ko } from "./ko";
import { ja } from "./ja";
import { hi } from "./hi";
import { ar } from "./ar";
import type { ServerExpoMessages } from "./es";

export type { ServerExpoMessages } from "./es";

export const serverExpo: Record<LocaleCode, ServerExpoMessages> = {
  es, en, fr, pt, it, ru, zh, ko, ja, hi, ar,
};
