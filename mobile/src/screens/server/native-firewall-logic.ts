import { nativeText } from '../../i18n/native-text';
export type FirewallRule = { number: number; to?: string; from?: string; action?: string; comment?: string };

/** Include a content signature so the server checks the live rule before delete. */
export function firewallRuleDeletePath(rule: FirewallRule): string {
  if (!Number.isInteger(rule.number) || rule.number < 1) throw new Error(nativeText("Invalid firewall rule number"));
  const signature = new URLSearchParams();
  for (const key of ["to", "from", "action", "comment"] as const) {
    if (typeof rule[key] === "string") signature.set(key, rule[key]);
  }
  if (!signature.has("to") || !signature.has("action")) throw new Error(nativeText("Firewall rule content is incomplete"));
  return `/api/firewall/rules/${rule.number}?${signature}`;
}
