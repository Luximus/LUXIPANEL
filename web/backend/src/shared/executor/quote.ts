// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shell quoting helpers.
 */

export function quoteArg(value: string): string {
  if (value.length === 0) return "''";
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function quoteCmd(command: string, args: string[]): string {
  return [command, ...args.map(quoteArg)].join(" ");
}
