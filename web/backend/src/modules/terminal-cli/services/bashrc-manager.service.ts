// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Bashrc manager — owns a single managed block inside the PTY user's
 * ~/.bashrc that auto-launches the configured CLI when an interactive
 * shell starts.
 *
 * The block lives between two markers:
 *
 *     # >>> luxipanel-cli-autostart >>>
 *     ...generated content...
 *     # <<< luxipanel-cli-autostart <<<
 *
 * When the active CLI is "default" the block is still written but is a
 * no-op (early-return), so an admin can audit what the panel touched.
 *
 * The previous legacy "# --- opencode autostart: …" block written by
 * hand is removed automatically the first time we update bashrc.
 */

import { quoteArg, type Executor } from "../../../shared/executor/index.js";
import { createModuleLogger } from "../../../shared/logger/index.js";
import { getCliCommand } from "./cli-catalog.js";
import type { CliId } from "../models/cli-state.model.js";

const log = createModuleLogger("bashrc-manager");

const BEGIN_MARKER = "# >>> luxipanel-cli-autostart >>>";
const END_MARKER = "# <<< luxipanel-cli-autostart <<<";
const LEGACY_BEGIN_PATTERN = /# --- opencode autostart[^\n]*\n[\s\S]*?\n\s*exec opencode\s*\nfi\s*\n?/m;

async function resolveHome(executor: Executor): Promise<string> {
  const result = await executor.exec('printf %s "${HOME:-}"');
  const home = (result.stdout ?? "").trim();
  if (!home) throw new Error("Cannot resolve $HOME for the PTY user");
  return home;
}

async function readBashrc(executor: Executor, home: string): Promise<string> {
  try {
    const raw = await executor.readFile(`${home}/.bashrc`, "utf-8");
    return typeof raw === "string" ? raw : raw.toString("utf-8");
  } catch {
    return "";
  }
}

function stripManagedBlock(content: string): string {
  const begin = content.indexOf(BEGIN_MARKER);
  const end = content.indexOf(END_MARKER);
  if (begin === -1 || end === -1 || end < begin) return content;
  const before = content.slice(0, begin).replace(/\n*$/, "");
  const after = content.slice(end + END_MARKER.length).replace(/^\n*/, "");
  return `${before}\n${after}`.replace(/\n{3,}/g, "\n\n");
}

function stripLegacyBlock(content: string): string {
  return content.replace(LEGACY_BEGIN_PATTERN, "");
}

function buildBlock(activeCli: CliId): string {
  const command = getCliCommand(activeCli);
  const hasCli = activeCli !== "default" && command.length > 0;
  const escapedCmd = command.replace(/"/g, '\\"');

  const lines = [
    BEGIN_MARKER,
    "# Bloque gestionado por LUXIPANEL — no editar a mano.",
    "# Para saltarlo en una sesión puntual: NO_LXP_CLI_AUTOSTART=1 bash",
    `# CLI activo: ${activeCli}${hasCli ? ` (${command})` : " — no autostart"}`,
    "if [[ $- == *i* ]] \\",
    '   && [[ -z "$LXP_CLI_AUTOSTART_DONE" ]] \\',
    '   && [[ -z "$NO_LXP_CLI_AUTOSTART" ]] \\',
    "   && [[ -t 1 ]]; then",
    "    export LXP_CLI_AUTOSTART_DONE=1",
  ];

  if (!hasCli) {
    lines.push("    :  # CLI activo = default → no se lanza nada");
    lines.push("fi");
    lines.push(END_MARKER);
    return lines.join("\n") + "\n";
  }

  lines.push(`    if ! command -v ${command} >/dev/null 2>&1; then`);
  lines.push(`        printf '\\033[33m[luxipanel]\\033[0m CLI configurado "${escapedCmd}" no encontrado en PATH; abriendo bash.\\n'`);
  lines.push("    else");
  lines.push("        _lxp_theme=dark");
  lines.push("        _lxp_old_stty=$(stty -g 2>/dev/null)");
  lines.push("        stty -echo -icanon min 0 time 0 2>/dev/null");
  lines.push("        printf '\\e]11;?\\e\\\\' > /dev/tty");
  lines.push("        _lxp_resp=");
  lines.push("        IFS= read -r -t 0.3 -N 32 _lxp_resp < /dev/tty 2>/dev/null");
  lines.push('        [ -n "$_lxp_old_stty" ] && stty "$_lxp_old_stty" 2>/dev/null');
  lines.push('        if [[ "$_lxp_resp" =~ rgb:([0-9a-fA-F]+)/([0-9a-fA-F]+)/([0-9a-fA-F]+) ]]; then');
  lines.push("            _lxp_r=$((16#${BASH_REMATCH[1]:0:2}))");
  lines.push("            _lxp_g=$((16#${BASH_REMATCH[2]:0:2}))");
  lines.push("            _lxp_b=$((16#${BASH_REMATCH[3]:0:2}))");
  lines.push("            if (( _lxp_r*299 + _lxp_g*587 + _lxp_b*114 >= 128000 )); then _lxp_theme=light; fi");
  lines.push('        elif [ -n "$COLORFGBG" ]; then');
  lines.push('            case "${COLORFGBG##*;}" in 7|9|10|11|12|13|14|15) _lxp_theme=light ;; esac');
  lines.push("        fi");
  lines.push('        if [ "$_lxp_theme" = "light" ]; then');
  lines.push("            _lxp_bg=$'\\033[48;5;255m'; _lxp_fg=$'\\033[38;5;238m'; _lxp_sp=$'\\033[38;5;33m'");
  lines.push("        else");
  lines.push("            _lxp_bg=$'\\033[48;5;234m'; _lxp_fg=$'\\033[38;5;252m'; _lxp_sp=$'\\033[38;5;81m'");
  lines.push("        fi");
  lines.push("        tput smcup 2>/dev/null; tput civis 2>/dev/null");
  lines.push("        _lxp_cols=$(tput cols 2>/dev/null || echo 80)");
  lines.push("        _lxp_rows=$(tput lines 2>/dev/null || echo 24)");
  lines.push(`        _lxp_text="Cargando ${escapedCmd}..."`);
  lines.push("        _lxp_len=$(( ${#_lxp_text} + 2 ))");
  lines.push("        _lxp_col=$(( (_lxp_cols - _lxp_len) / 2 + 1 ))");
  lines.push("        _lxp_row=$(( _lxp_rows / 2 ))");
  lines.push("        printf '%s\\033[2J' \"$_lxp_bg\"");
  lines.push("        _lxp_frames=(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏)");
  lines.push("        _lxp_n=${#_lxp_frames[@]}");
  lines.push("        for ((_lxp_k=0; _lxp_k<14; _lxp_k++)); do");
  lines.push("            printf '\\033[%d;%dH%s%s%s %s%s' \\");
  lines.push('                "$_lxp_row" "$_lxp_col" \\');
  lines.push('                "$_lxp_bg" "$_lxp_sp" "${_lxp_frames[_lxp_k % _lxp_n]}" \\');
  lines.push('                "$_lxp_fg" "$_lxp_text"');
  lines.push("            sleep 0.07");
  lines.push("        done");
  lines.push("        printf '\\033[0m'");
  lines.push("        tput cnorm 2>/dev/null");
  lines.push("        unset _lxp_theme _lxp_old_stty _lxp_resp _lxp_r _lxp_g _lxp_b _lxp_bg _lxp_fg _lxp_sp _lxp_cols _lxp_rows _lxp_text _lxp_len _lxp_col _lxp_row _lxp_frames _lxp_n _lxp_k");
  lines.push(`        exec ${command}`);
  lines.push("    fi");
  lines.push("fi");
  lines.push(END_MARKER);
  return lines.join("\n") + "\n";
}

function ensureTrailingNewline(content: string): string {
  if (!content) return "";
  return content.endsWith("\n") ? content : content + "\n";
}

async function writeBashrcAtomic(executor: Executor, home: string, content: string): Promise<void> {
  const target = `${home}/.bashrc`;
  const tmp = `${home}/.bashrc.luxipanel-new`;
  await executor.writeFile(tmp, content, { encoding: "utf-8" });
  await executor.exec(`mv -f ${quoteArg(tmp)} ${quoteArg(target)}`);
}

export const bashrcManager = {
  /**
   * Regenerates the managed block in ~/.bashrc for the PTY user. The executor
   * is REQUIRED and must target the CONNECTED server (the machine the user
   * shells into) — never the panel host. There is no `localExecutor` fallback:
   * defaulting to it would mutate the panel host's ~/.bashrc, a cross-server
   * foot-gun and an isolation break (CLAUDE.md §"Aislamiento total por servidor").
   */
  async applyActiveCli(activeCli: CliId, executor: Executor): Promise<{ path: string }> {
    const home = await resolveHome(executor);
    const original = await readBashrc(executor, home);
    const withoutManaged = stripManagedBlock(original);
    const withoutLegacy = stripLegacyBlock(withoutManaged);
    const base = ensureTrailingNewline(withoutLegacy.trimEnd());
    const next = base + (base ? "\n" : "") + buildBlock(activeCli);
    await writeBashrcAtomic(executor, home, next);
    log.info({ activeCli, home }, "bashrc managed block updated");
    return { path: `${home}/.bashrc` };
  },
};
