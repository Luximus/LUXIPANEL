// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { quoteArg, type Executor } from "../../../shared/executor/index.js";
import { ValidationError } from "../../../shared/errors/index.js";
import { ensureProjectStorage } from "../../ai-assistant/services/project-storage.service.js";
import type { AssistantProject } from "../../ai-assistant/repositories/projects.repository.js";
import { containersRepository } from "../repositories/containers.repository.js";
import { vaultsRepository } from "../repositories/vaults.repository.js";

/** Copy historical notes once, verify bytes, then repoint only this project's
 * registration. Originals remain on disk; shared vaults keep their identity. */
export async function connectProjectStorageVault(executor: Executor, project: AssistantProject) {
  const { storagePath: root } = await ensureProjectStorage(executor, project);
  const container = await containersRepository.findByRefKey(executor, `project:${project.id}`);
  const source = container?.path ?? "";
  const notes = `${root}/notes`;
  const script = String.raw`
import os,sys,tempfile,shutil,hashlib,fcntl,json
root,source=sys.argv[1:]; dest=root+'/notes'
with open(root+'/storage.json','rb') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX)
 if os.path.realpath(dest)!=dest: raise Exception('Unsafe notes directory')
 if source==dest: sys.exit(0)
 if os.path.isdir(dest):
  marker=json.load(open(dest+'/.migration.json'))
  if marker['source']!=source: raise Exception('Conflicting notes directory')
  sys.exit(0)
 if source and not os.path.isdir(source): raise Exception('Historical notes unavailable')
 stage=tempfile.mkdtemp(prefix='.notes-',dir=root); total=0
 try:
  if source:
   for base,dirs,files in os.walk(source,followlinks=False):
    for d in dirs:
     if os.path.islink(os.path.join(base,d)): raise Exception('Linked notes directory requires review')
    for name in files:
     if not name.endswith(('.md','.canvas','.txt')): continue
     src=os.path.join(base,name)
     if os.path.islink(src): raise Exception('Linked note requires review')
     data=open(src,'rb').read(32*1024*1024+1); total+=len(data)
     if total>64*1024*1024: raise Exception('Notes exceed migration size limit')
     target=os.path.join(stage,os.path.relpath(src,source)); os.makedirs(os.path.dirname(target),mode=0o700,exist_ok=True)
     with open(target,'xb') as out: out.write(data)
     os.chmod(target,0o600)
     if open(target,'rb').read()!=data: raise Exception('Notes copy verification failed')
  with open(stage+'/.migration.json','w') as f: json.dump({'source':source},f)
  os.chmod(stage+'/.migration.json',0o600)
  os.rename(stage,dest)
 finally:
  if os.path.isdir(stage): shutil.rmtree(stage)
`;
  const copy = await executor.exec(`python3 -c ${quoteArg(script)} ${quoteArg(root)} ${quoteArg(source)}`, { timeoutMs: 30000 });
  if (copy.exitCode !== 0) throw new ValidationError("No se pudieron migrar las notas de Obsidian; se conserva su ubicación anterior.");
  let vault = await vaultsRepository.findByPath(executor, root);
  if (!vault && container) {
    const links = (await containersRepository.list(executor)).filter(c => c.vaultId === container.vaultId);
    const old = await vaultsRepository.get(executor, container.vaultId);
    if (old && links.length === 1 && old.path === source) {
      await vaultsRepository.update(executor, old.id, { path: root, shallow: false });
      vault = { ...old, path: root, shallow: false };
    }
  }
  vault ??= await vaultsRepository.create(executor, { name: project.title, path: root, shallow: false });
  if (container) await containersRepository.update(executor, container.id, { path: notes, vaultId: vault.id });
  else await containersRepository.create(executor, { kind: "project", refKey: `project:${project.id}`, name: project.title, path: notes, vaultId: vault.id });
  return vault;
}
