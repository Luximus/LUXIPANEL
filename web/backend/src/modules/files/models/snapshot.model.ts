// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Files "safe changes" snapshots — model.
 *
 * A snapshot is a mini-backup of a path's state captured *before* a panel-driven
 * mutation (edit, delete, move/rename, replace, chmod). It lets the user restore
 * the previous version, compare before/after, or download the backup.
 *
 * Metadata lives in the per-server kv-store (`files/snapshots.json`); the actual
 * bytes live as a separate blob under `${LUXIPANEL_CONFIG_DIR}/files-snapshots/`
 * so the metadata collection stays small and `list()` cheap.
 */

/** Which filesystem operation triggered the capture. */
export type SnapshotOp =
  | "edit"
  | "delete"
  | "move"
  | "replace"
  | "copy"
  | "chmod"
  | "restore";

/** What we actually captured for the pre-mutation state. */
export type SnapshotKind =
  // A regular file whose bytes were copied into the blob.
  | "file"
  // A directory captured as a tar.gz blob.
  | "dir"
  // The path did not exist before the op (e.g. first write / new file) —
  // "restoring" means deleting whatever exists now.
  | "absent"
  // The path was too large to capture under FILES_SNAPSHOT_MAX_BYTES; metadata
  // only, no blob, restore unavailable.
  | "skipped";

export interface SnapshotRecord {
  id: string;
  /** Absolute path on the client server that was about to change. */
  path: string;
  op: SnapshotOp;
  kind: SnapshotKind;
  /** Size of the captured blob in bytes (0 for absent/skipped). */
  sizeBytes: number;
  /** Octal mode string of the pre-state (e.g. "0644"), when known. */
  originalMode?: string;
  /** Blob file name under the snapshot dir. Undefined for absent/skipped. */
  blobName?: string;
  /** Reason text for skipped captures (shown in the UI). */
  note?: string;
  /** ISO timestamp of capture (mirrors dataStore createdAt). */
  capturedAt: string;
  createdAt?: string;
  updatedAt?: string;
}
