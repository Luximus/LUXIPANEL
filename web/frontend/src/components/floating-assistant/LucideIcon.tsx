// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Renders a lucide icon by its PascalCase name. Only the curated set used
 * by the project picker is imported, to keep the bundle small.
 */
import {
  Folder, FolderGit2, Rocket, Code, Terminal, Database,
  Server, Cloud, Globe, Shield, Mail, Bug,
  Cpu, Box, Package, Wrench, Settings, FlaskConical,
  Book, FileText, Briefcase, Star, Zap, Layers,
  MessageSquare,
} from "lucide-react";
import type { ComponentType } from "react";

const MAP: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  Folder, FolderGit2, Rocket, Code, Terminal, Database,
  Server, Cloud, Globe, Shield, Mail, Bug,
  Cpu, Box, Package, Wrench, Settings, FlaskConical,
  Book, FileText, Briefcase, Star, Zap, Layers,
  MessageSquare,
};

export function LucideIcon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const Cmp = MAP[name] ?? Folder;
  return <Cmp size={size} className={className} />;
}
