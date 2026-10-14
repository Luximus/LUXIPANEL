// Backups page — shared types for the folder browser + source selectors.
// Leaf module (no cross-submodule imports).

export type DbSelection = { engine: "mysql" | "postgresql"; name: string };

// A source selector instance exposes hooks the shared dialogs call back into.
export interface SourcesController {
  addFolder(path: string): void;
  setDatabases(sel: DbSelection[]): void;
  getDatabases(): DbSelection[];
  hydrate(value: { fullServer?: boolean; includeDatabases?: boolean; databaseSelections?: DbSelection[] | null; includeMail?: boolean; includePanelConfig?: boolean; includePaths?: string[] | null }): void;
}
