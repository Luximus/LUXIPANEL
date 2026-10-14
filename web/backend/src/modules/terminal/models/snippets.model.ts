// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Terminal snippet types — per-user categories, tags, and commands.
 */

export interface TerminalSnippetCategory {
  id: number;
  userId: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewTerminalSnippetCategory {
  id?: number;
  userId: number;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TerminalSnippetTag {
  id: number;
  userId: number;
  categoryId: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewTerminalSnippetTag {
  id?: number;
  userId: number;
  categoryId: number;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TerminalSnippet {
  id: number;
  userId: number;
  categoryId: number;
  name: string;
  command: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewTerminalSnippet {
  id?: number;
  userId: number;
  categoryId: number;
  name: string;
  command: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TerminalSnippetTagLink {
  snippetId: number;
  tagId: number;
}

export interface NewTerminalSnippetTagLink {
  snippetId: number;
  tagId: number;
}
