import { api } from "/scripts/extracted/lib/mail-api-client.js?v=20260930a";
import { S } from "./state";
export type AccountOption = { id: number; address: string; domain: string };
/** Load picker options on demand, independently of the table's visible page. */
export async function loadAccountCatalog(): Promise<AccountOption[]> {
  const response = await api.get<AccountOption[]>("/api/accounts?catalog=1&includeUsage=false");
  return response.ok && Array.isArray(response.data) ? response.data : S.accounts;
}
