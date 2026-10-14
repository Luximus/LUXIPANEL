// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** Postfix BCC delivery into a private, separate Maildir tree. */
import { mailConfig } from "../../../config/mail.js";
import { quoteArg, quoteCmd, type Executor } from "../../../shared/executor/index.js";
import { execChecked, removeStagedFile, stageSecretFile, writeRootOwnedFile } from "./staging.helpers.js";

export type ArchiveRule = { domain: string; incoming: boolean; outgoing: boolean; retentionDays: number };
const root = "/var/lib/luxipanel/mail-archive";
const scriptPath = "/usr/local/libexec/luxipanel-mail-archive.py";
const suffix = "archive.luxipanel.invalid";
const retentionConfig = "/etc/luxipanel/mail-archive-retention.json";
const retentionScript = `/usr/local/libexec/luxipanel-mail-archive-retention.py`;
const retentionJob = `/etc/cron.daily/luxipanel-mail-archive`;

export const archivePurgeScript = `#!/usr/bin/python3
import json, os, re, time
ROOT = ${JSON.stringify(root)}
with open(${JSON.stringify(retentionConfig)}, encoding='utf-8') as handle:
    rules = json.load(handle)
for domain, days in rules.items():
    if not re.fullmatch(r'[a-z0-9.-]+', domain) or '..' in domain or not isinstance(days, int) or days < 1:
        continue
    cutoff = time.time() - days * 86400
    for direction in ('incoming', 'outgoing'):
        for folder in ('new', 'cur'):
            path = os.path.join(ROOT, domain, direction, 'Maildir', folder)
            chain = (ROOT, os.path.join(ROOT, domain), os.path.join(ROOT, domain, direction), os.path.join(ROOT, domain, direction, 'Maildir'), path)
            if any(os.path.islink(part) for part in chain) or not os.path.isdir(path):
                continue
            with os.scandir(path) as entries:
                for item in entries:
                    if item.is_file(follow_symlinks=False) and item.stat(follow_symlinks=False).st_mtime < cutoff:
                        os.unlink(item.path)
`;

// The pipe process runs as vmail. Restrict destinations to the reserved
// archive domain and copy into Maildir with an exclusive temporary file.
export const archiveDeliveryScript = `#!/usr/bin/python3
import os, re, socket, sys, time, uuid
ROOT = ${JSON.stringify(root)}
match = re.fullmatch(r'(in|out)--([a-z0-9.-]+)@archive\\.luxipanel\\.invalid', sys.argv[1].lower() if len(sys.argv) == 2 else '')
if not match or '..' in match[2] or match[2].startswith(('.', '-')):
    sys.exit(67)
direction, domain = match.groups()
base = os.path.join(ROOT, domain, 'incoming' if direction == 'in' else 'outgoing', 'Maildir')
for leaf in ('tmp', 'new', 'cur'):
    os.makedirs(os.path.join(base, leaf), mode=0o700, exist_ok=True)
name = str(int(time.time())) + '.' + uuid.uuid4().hex + '.' + socket.gethostname().replace('/', '_')
temp = os.path.join(base, 'tmp', name)
final = os.path.join(base, 'new', name)
try:
    with open(temp, 'xb', buffering=0) as handle:
        while True:
            chunk = sys.stdin.buffer.read(65536)
            if not chunk:
                break
            handle.write(chunk)
        os.fsync(handle.fileno())
    os.rename(temp, final)
except Exception:
    try: os.unlink(temp)
    except FileNotFoundError: pass
    raise
`;

export const archiveListScript = `import email.parser, email.header, heapq, json, os, sys
root, domain, direction, limit = sys.argv[1:]
base = os.path.join(root, domain, direction, 'Maildir')
items = []
for folder in ('new', 'cur'):
    path = os.path.join(base, folder)
    if not os.path.isdir(path): continue
    for item in os.scandir(path):
        if not item.is_file(follow_symlinks=False): continue
        stat = item.stat(follow_symlinks=False)
        items.append((stat.st_mtime, stat.st_size, folder, item.name))
out = []
for modified, size, folder, name in heapq.nlargest(int(limit), items):
    path = os.path.join(base, folder, name)
    with open(path, 'rb') as handle:
        header = handle.read(65536).split(b'\\n\\n', 1)[0]
    message = email.parser.BytesHeaderParser().parsebytes(header)
    out.append(dict(name=name, folder=folder, size=size, receivedAt=modified,
                    subject=str(email.header.make_header(email.header.decode_header(message.get('Subject', '')))),
                    sender=str(email.header.make_header(email.header.decode_header(message.get('From', '')))),
                    recipient=str(email.header.make_header(email.header.decode_header(message.get('To', ''))))))
print(json.dumps(out))`;

async function vmailUsername(executor: Executor): Promise<string> {
  const passwd = await executor.exec(quoteCmd("getent", ["passwd", String(mailConfig.vmail.uid)]));
  if (passwd.exitCode !== 0) throw new Error(`No existe el usuario vmail UID ${mailConfig.vmail.uid}`);
  const username = passwd.stdout.split(":")[0] ?? "";
  if (!/^[a-z_][a-z0-9_-]*$/i.test(username)) throw new Error("Usuario vmail inválido");
  return username;
}

export async function listArchivedMessages(executor: Executor, domain: string, direction: "incoming" | "outgoing", limit: number) {
  const username = await vmailUsername(executor);
  const pathDirection = direction === "incoming" ? "incoming" : "outgoing";
  const result = await executor.exec(quoteCmd("sudo", ["-u", username, "python3", "-c", archiveListScript, root, domain, pathDirection, String(limit)]));
  if (result.exitCode !== 0) throw new Error(`No se pudo consultar el archivo: ${result.stderr}`);
  return JSON.parse(result.stdout) as Array<{ name: string; folder: string; size: number; receivedAt: number; subject: string; sender: string; recipient: string }>;
}

export async function readArchivedMessage(executor: Executor, domain: string, direction: "incoming" | "outgoing", folder: string, name: string): Promise<Buffer> {
  if (!/^(new|cur)$/.test(folder) || !/^[0-9]+\.[a-f0-9]{32}\.[A-Za-z0-9._-]+(?::2,[A-Za-z]*)?$/.test(name)) throw new Error("Nombre de mensaje archivado inválido");
  const username = await vmailUsername(executor);
  const path = `${root}/${domain}/${direction}/Maildir/${folder}/${name}`;
  const stat = await executor.exec(quoteCmd("sudo", ["-u", username, "stat", "-c", "%s", "--", path]));
  if (stat.exitCode !== 0) throw new Error("Mensaje archivado no encontrado");
  const size = Number(stat.stdout.trim());
  if (!Number.isSafeInteger(size) || size < 0 || size > 25 * 1024 * 1024) throw new Error("El mensaje archivado supera 25 MB");
  const staged = await stageSecretFile(executor, "archive-read", "");
  try {
    const command = `${quoteCmd("sudo", ["-u", username, "cat", "--", path])} > ${quoteArg(staged)}`;
    await execChecked(executor, quoteCmd("sudo", ["sh", "-c", command]), "leer mensaje archivado");
    const data = await executor.readFile(staged, "latin1");
    return Buffer.isBuffer(data) ? data : Buffer.from(data, "latin1");
  } finally {
    await removeStagedFile(executor, staged);
  }
}

export async function inspectArchiveIntegration(executor: Executor): Promise<{ available: boolean; reason: string }> {
  const mapBase = mailConfig.postfix.vmailbox.replace("vmailbox", "archive_luxipanel");
  const result = await executor.exec(quoteCmd("sudo", ["postconf", "-h", "sender_bcc_maps", "recipient_bcc_maps", "transport_maps"]));
  if (result.exitCode !== 0) return { available: false, reason: "Postfix no está disponible" };
  const config = result.stdout;
  const service = await executor.exec(quoteCmd("sudo", ["postconf", "-M", "luxipanelarchive/unix"]));
  if (service.exitCode !== 0 || !service.stdout.includes(scriptPath)) return { available: false, reason: "El transporte de archivo no está configurado" };
  if (![`${mapBase}_sender`, `${mapBase}_recipient`, `${mapBase}_transport`].every((name) => config.includes(`hash:${name}`))) {
    return { available: false, reason: "Los mapas de archivo no están conectados a Postfix" };
  }
  return { available: true, reason: "Archivo conectado a Postfix" };
}

async function postconfValue(executor: Executor, param: string): Promise<string> {
  const result = await executor.exec(quoteCmd("sudo", ["postconf", "-h", param]));
  if (result.exitCode !== 0) throw new Error(`postconf ${param}: ${result.stderr}`);
  return result.stdout.trim();
}

async function ensureMap(executor: Executor, param: string, map: string, prepend = false): Promise<void> {
  const current = await postconfValue(executor, param);
  const parts = current.split(/[\s,]+/).filter(Boolean);
  if (parts.includes(map)) return;
  await execChecked(executor, quoteCmd("sudo", ["postconf", "-e", `${param} = ${(prepend ? [map, ...parts] : [...parts, map]).join(", ")}`]), `activar ${param}`);
}

async function assertNoBccConflicts(executor: Executor, rules: ArchiveRule[], mapBase: string): Promise<void> {
  for (const [param, flag] of [["sender_bcc_maps", "outgoing"], ["recipient_bcc_maps", "incoming"]] as const) {
    const maps = (await postconfValue(executor, param)).split(/[\s,]+/).filter((value) => value && !value.includes(mapBase));
    for (const rule of rules.filter((item) => item[flag])) {
      for (const map of maps) {
        for (const address of [`archive-probe@${rule.domain}`, `@${rule.domain}`]) {
          const result = await executor.exec(quoteCmd("sudo", ["postmap", "-q", address, map]));
          if (result.exitCode !== 0) throw new Error(`No se pudo verificar ${param}: ${result.stderr}`);
          if (result.stdout.trim()) throw new Error(`La regla ${param} existente para ${rule.domain} tiene prioridad sobre el archivo`);
        }
      }
    }
  }
}

export async function applyArchiveRules(executor: Executor, rules: ArchiveRule[]): Promise<void> {
  const mapBase = mailConfig.postfix.vmailbox.replace("vmailbox", "archive_luxipanel");
  if (mapBase === mailConfig.postfix.vmailbox) throw new Error("POSTFIX_VMAILBOX debe contener vmailbox");
  const active = rules.filter((rule) => rule.incoming || rule.outgoing);
  const sender = active.filter((rule) => rule.outgoing).map((rule) => `@${rule.domain} out--${rule.domain}@${suffix}`).join("\n");
  const recipient = active.filter((rule) => rule.incoming).map((rule) => `@${rule.domain} in--${rule.domain}@${suffix}`).join("\n");
  const transport = `${suffix} luxipanelarchive:`;
  const uid = String(mailConfig.vmail.uid);
  const gid = String(mailConfig.vmail.gid);
  // Probe all dependencies before modifying the live Postfix configuration.
  for (const program of ["postconf", "postmap", "python3"]) {
    await execChecked(executor, quoteCmd("command", ["-v", program]), `falta ${program}`);
  }
  const username = await vmailUsername(executor);
  await assertNoBccConflicts(executor, active, mapBase);
  const needsRetention = active.some((rule) => rule.retentionDays > 0);
  if (needsRetention) {
    await execChecked(executor, quoteCmd("test", ["-d", "/etc/cron.daily"]), "cron.daily no disponible");
    await execChecked(executor, quoteCmd("sudo", ["install", "-d", "-m", "0755", "/etc/luxipanel"]), "crear directorio de retención");
    await execChecked(executor, quoteCmd("sudo", ["install", "-d", "-m", "0755", "/usr/local/libexec"]), "crear libexec");
    await writeRootOwnedFile(executor, "archive", retentionConfig, JSON.stringify(Object.fromEntries(active.filter((rule) => rule.retentionDays > 0).map((rule) => [rule.domain, rule.retentionDays]))), 0o600, "0600");
    await writeRootOwnedFile(executor, "archive", retentionScript, archivePurgeScript, 0o755, "0755");
    await writeRootOwnedFile(executor, "archive", retentionJob, `#!/bin/sh\nexec /usr/bin/python3 ${retentionScript}\n`, 0o755, "0755");
  } else {
    await executor.exec(quoteCmd("sudo", ["rm", "-f", retentionJob]));
  }
  if (active.length) {
    await execChecked(executor, quoteCmd("sudo", ["install", "-d", "-m", "0700", "-o", uid, "-g", gid, root]), "crear archivo privado");
    await execChecked(executor, quoteCmd("sudo", ["install", "-d", "-m", "0755", "/usr/local/libexec"]), "crear libexec");
    await writeRootOwnedFile(executor, "archive", scriptPath, archiveDeliveryScript, 0o755, "0755");
    const service = `luxipanelarchive unix - n n - 1 pipe flags=Rq user=${username} argv=/usr/bin/python3 ${scriptPath} \${recipient}`;
    const existing = await executor.exec(quoteCmd("sudo", ["postconf", "-M", "luxipanelarchive/unix"]));
    if (existing.exitCode === 0 && !existing.stdout.includes(scriptPath)) throw new Error("El transporte luxipanelarchive ya pertenece a otra configuración");
    await execChecked(executor, quoteCmd("sudo", ["postconf", "-M", "-e", `luxipanelarchive/unix=${service}`]), "configurar transporte de archivo");
    await execChecked(executor, quoteCmd("sudo", ["postconf", "-e", "luxipanelarchive_destination_recipient_limit = 1"]), "limitar destinatarios de archivo");
  }
  const files = [
    [`${mapBase}_sender`, sender],
    [`${mapBase}_recipient`, recipient],
    [`${mapBase}_transport`, transport],
  ] as const;
  for (const [path, contents] of files) {
    await writeRootOwnedFile(executor, "postfix", path, `${contents}\n`, 0o644, "0644");
    await execChecked(executor, quoteCmd("sudo", ["postmap", path]), `postmap ${path}`);
  }
  await ensureMap(executor, "sender_bcc_maps", `hash:${mapBase}_sender`);
  await ensureMap(executor, "recipient_bcc_maps", `hash:${mapBase}_recipient`);
  await ensureMap(executor, "transport_maps", `hash:${mapBase}_transport`, true);
  await execChecked(executor, quoteCmd("sudo", ["postfix", "check"]), "postfix check");
  await execChecked(executor, quoteCmd("sudo", ["systemctl", "reload", "postfix"]), "recargar Postfix");
}
