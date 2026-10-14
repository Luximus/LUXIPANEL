import dictionaries from "../i18n/permission-label-messages.json";
import type { PermissionLabelMessages } from "./permission-labels";
export function getPermissionLabelMessages(language?: string): PermissionLabelMessages {
 const messages = dictionaries as Record<string, PermissionLabelMessages>;
 return messages[(language ?? "es").toLowerCase().split(/[-_]/)[0]] ?? messages.en;
}
