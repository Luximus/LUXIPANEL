import type { LocaleCode } from "../../../locales";
import type { JobsMessages } from "./es";
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

export type { JobsMessages } from "./es";

export const jobs: Record<LocaleCode, JobsMessages> = {
  es, en, fr, pt, it, ru, zh, ko, ja, hi, ar,
};
