import es from "@/i18n/es/permissions";
import en from "@/i18n/en/permissions";
import pt from "@/i18n/pt/permissions";
import fr from "@/i18n/fr/permissions";
import de from "@/i18n/de/permissions";
import it from "@/i18n/it/permissions";
import ja from "@/i18n/ja/permissions";
import ko from "@/i18n/ko/permissions";
import ru from "@/i18n/ru/permissions";
import ar from "@/i18n/ar/permissions";
import hi from "@/i18n/hi/permissions";
import bn from "@/i18n/bn/permissions";
import type { PermissionLabelMessages } from "./permission-labels";
export const permissionLabelMessages: Record<string, PermissionLabelMessages> = Object.fromEntries(
  Object.entries({ es, en, pt, fr, de, it, ja, ko, ru, ar, hi, bn }).map(([locale, messages]) => [locale, messages.permissionLabels]),
);
export function getPermissionLabelMessages(language: string): PermissionLabelMessages {
  return permissionLabelMessages[language.toLowerCase().split(/[-_]/)[0]] ?? permissionLabelMessages.en;
}
