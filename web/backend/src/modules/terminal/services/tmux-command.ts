/** Use a session-specific key table, preserving the user's root bindings.
 * Fullscreen programs may stop requesting mouse reports after a subprocess
 * exits. Their alternate screen has no tmux history: copy-mode shows [0/0].
 * Codex still accepts wheel reports in that state. Forward the actual wheel
 * coordinates, preserving its small line increments instead of paging. Check
 * the foreground process so raw mouse escapes never reach another program.
 * Other fullscreen programs retain the keyboard fallback; normal mouse and
 * shell scrollback / copy-mode behavior stay native. */

// These are tmux command strings, not shell commands. Quote nested arguments
// for tmux's parser, including the shell predicate's literal backslash.
const tmuxQuote = (value: string): string => `"${value.replace(/[\\"$]/g, "\\$&")}"`;

export function tmuxScrollArgs(name: string): string[] {
  const table = "lxp-terminal-scroll";
  const args = [
    "set-option", "-t", name, "mouse", "on",
    ";", "run-shell", `tmux list-keys -T root | sed 's/-T root /-T ${table} /' | tmux source-file -`,
  ];
  const codexForeground = "ps -t #{q:pane_tty} -o comm=,stat= | grep -Eq '^codex[[:space:]]+[^[:space:]]*\\+'";
  const mouseX = "#{e|+|:#{e|-|:#{mouse_x},#{pane_left}},1}";
  const mouseY = "#{e|+|:#{e|-|:#{mouse_y},#{pane_top}},1}";
  for (const [wheel, button, page, fallback] of [
    ["WheelUpPane", 64, "PageUp", "copy-mode -e -t ="],
    ["WheelDownPane", 65, "PageDown", "send-keys -M"],
  ] as const) {
    // run-shell expands mouse coordinates before launching the predicate.
    // send-keys -F does not expand literal input on all supported tmux versions.
    const report = `tmux send-keys -t #{q:pane_id} -l '\x1b[<${button};${mouseX};${mouseY}M'`;
    const fullscreen = `run-shell ${tmuxQuote(`if ${codexForeground}; then ${report}; else tmux send-keys -t #{q:pane_id} ${page}; fi`)}`;
    args.push(
      ";", "bind-key", "-T", table, wheel,
      "if-shell", "-F", "-t", "=", "#{||:#{pane_in_mode},#{mouse_any_flag}}",
      "send-keys -M",
      `if-shell -F -t = '#{alternate_on}' ${tmuxQuote(fullscreen)} ${tmuxQuote(fallback)}`,
    );
  }
  args.push(";", "set-option", "-t", name, "key-table", table);
  return args;
}

/** Configure both new and reattached persistent terminals. */
export function tmuxSessionArgs(name: string, shell: string, clientManagesCli: boolean): string[] {
  return [
    "-u", "new-session", "-A", "-s", name,
    ...(clientManagesCli ? ["env", "NO_LXP_CLI_AUTOSTART=1", shell] : []),
    ";", ...tmuxScrollArgs(name),
  ];
}
