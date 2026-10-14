/** Atomic grants retained when several Linux groups contribute permissions. */
export interface FileAccessGrant {
  actions?: string[];
  allowAll: boolean;
  allowPaths: string[];
  denyPaths: string[];
  readOnlyPaths: string[];
}
export interface CommandGrant {
  actions?: string[];
  allowAll: boolean;
  groups: string[];
  allowCommands: string[];
  denyCommands: string[];
}
