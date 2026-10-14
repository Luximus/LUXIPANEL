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
import type { ServerObsidianMessages } from "./es";

export type { ServerObsidianMessages } from "./es";

export const serverObsidian: Record<LocaleCode, ServerObsidianMessages> = {
  es, en, fr, pt, it, ru, zh, ko, ja, hi, ar,
};
