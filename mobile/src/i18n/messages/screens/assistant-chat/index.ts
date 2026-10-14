// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { LocaleCode } from "../../../locales";
import type { AssistantChatMessages } from "./es";
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

export type { AssistantChatMessages } from "./es";

export const assistantChat: Record<LocaleCode, AssistantChatMessages> = {
  // `es` es `as const` (fuente del tipo): sus arrays readonly se re-tipan al
  // ancho mutable de `Widen` al ensamblar.
  es: es as AssistantChatMessages,
  en,
  fr,
  pt,
  it,
  ru,
  zh,
  ko,
  ja,
  hi,
  ar,
};
