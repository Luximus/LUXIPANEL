/**
 * Mapa mínimo nombre → componente `lucide-react` para el icono de un agente o
 * proyecto. `agent.icon`/`project.icon` NO guardan un nombre "Tabler" (`ti-…`):
 * guardan el nombre PascalCase del icono `lucide-react`/`lucide-react-native`
 * tal cual (ver `LUXIPANEL/frontend/src/components/floating-assistant/LucideIcon.tsx`
 * y el selector `ICON_PRESETS` del editor de roles de la app — mismo patrón:
 * un `Record` curado + fallback fijo si el nombre no está en el set). Se
 * mantiene el nombre de archivo `ti-icon-map` por continuidad con el resto del
 * ecosistema, pero la resolución es directa por nombre de icono lucide.
 */
import {
  Bot,
  Book,
  Box,
  Briefcase,
  Bug,
  Cloud,
  Code,
  Cpu,
  Database,
  FileText,
  FlaskConical,
  Folder,
  FolderGit2,
  Globe,
  Layers,
  Mail,
  MessageSquare,
  Package,
  Rocket,
  Server,
  Settings,
  Shield,
  Star,
  Terminal,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Bot,
  Book,
  Box,
  Briefcase,
  Bug,
  Cloud,
  Code,
  Cpu,
  Database,
  FileText,
  FlaskConical,
  Folder,
  FolderGit2,
  Globe,
  Layers,
  Mail,
  MessageSquare,
  Package,
  Rocket,
  Server,
  Settings,
  Shield,
  Star,
  Terminal,
  Wrench,
  Zap,
};

/** Resuelve el icono de un agente/proyecto por nombre; `Bot` (avatar de agente
 *  suelto) si no hay match — pasa `Folder` como `fallback` para proyectos. */
export function resolveTiIcon(name: string | null | undefined, fallback: LucideIcon = Bot): LucideIcon {
  if (!name) return fallback;
  return ICON_MAP[name] ?? fallback;
}
