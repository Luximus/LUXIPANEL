// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { randomUUID } from "node:crypto";
import { posix } from "node:path";
import { panelConfigDir } from "../../../config/paths.js";
import { getContextUser, pathInFileJail, quoteArg, type Executor } from "../../../shared/executor/index.js";
import { canAccessPath } from "../../../shared/auth/role-permissions.js";
import { ConflictError, ForbiddenError, ValidationError } from "../../../shared/errors/index.js";
import type { AssistantProject } from "../repositories/projects.repository.js";

export const PROJECT_DOCUMENTS = { claude: "CLAUDE.md", codex: "AGENTS.md", gemini: "GEMINI.md" } as const;
export function projectStorageRoot(project: Pick<AssistantProject, "id">): string {
  if (!project.id || !/^[a-zA-Z0-9_-]{1,128}$/.test(project.id)) throw new ValidationError("Identificador de proyecto inválido.");
  return posix.join(panelConfigDir(), "assistant/projects", project.id);
}

/** The backing directory is server-owned. Authorization remains attached to
 * the project/workspace, never a blanket grant to /etc/luxipanel. */
export function assertProjectStorageAccess(project: AssistantProject, op: "read" | "write") {
  const user = getContextUser();
  const scope = project.path || projectStorageRoot(project);
  if (!pathInFileJail(scope) || (user && !canAccessPath(user, scope, op))) throw new ForbiddenError("No tienes acceso a los datos del proyecto.");
}

// A target-side transaction keeps migration atomic across backend processes.
// Reads never create directories; only migrate/write may mutate. No shell
// interpolation of file content, no privileged fallback, no workspace deletes.
const SCRIPT = String.raw`
import os,sys,json,hashlib,tempfile,shutil,fcntl,stat,base64
p=json.loads(open(sys.argv[1]).read()) if sys.argv[1].startswith('/') else json.loads(base64.b64decode(sys.argv[1]))
root=p['root']; action=p['action']; source=p.get('source',''); limit=524288
def inside(base,path):
 return os.path.commonpath([base,path])==base
def checked(base,rel):
 base=os.path.realpath(base); dest=os.path.realpath(os.path.join(base,rel))
 if not inside(base,dest) or dest==base: raise Exception('Ruta fuera del proyecto')
 return dest
def digest(b): return hashlib.sha256(b).hexdigest()
def read(path,cap=limit):
 try:
  with open(path,'rb') as f: data=f.read(cap+1)
 except FileNotFoundError:
  if os.path.lexists(path): raise Exception('Enlace inválido')
  return None
 if len(data)>cap: raise Exception('El archivo supera el límite permitido (512 KB para documentos)')
 return data
def snapshot():
 manifest=read(checked(root,'storage.json'))
 if manifest is None: return None
 m=json.loads(manifest)
 if m.get('version')!=1 or m.get('projectId')!=p['id']: raise Exception('Datos de proyecto no reconocidos')
 return m
def atomic(path,data,mode=0o600):
 os.makedirs(os.path.dirname(path),mode=0o700,exist_ok=True)
 fd,tmp=tempfile.mkstemp(prefix='.write-',dir=os.path.dirname(path))
 try:
  with os.fdopen(fd,'wb') as f: f.write(data); f.flush(); os.fsync(f.fileno())
  os.chmod(tmp,mode); os.replace(tmp,path)
 finally:
  if os.path.exists(tmp): os.unlink(tmp)
def inspect():
 m=snapshot(); base=root if m else source
 if not m and source and not os.path.isdir(source): raise Exception('El directorio anterior no está disponible')
 content=read(checked(base,p['rel'])) if base else None
 return dict(managed=bool(m),root=base,storagePath=root,content=(content or b'').decode('utf8'),exists=content is not None,manifest=m)
try:
 # Refuse symlinked storage directories, including parents below config root.
 anchor=os.path.realpath(p['anchor'])
 if os.path.realpath(root)!=os.path.join(anchor,'assistant','projects',p['id']): raise Exception('Ruta de datos insegura')
 if action=='read': result=inspect()
 else:
  os.makedirs(os.path.dirname(root),mode=0o700,exist_ok=True)
  lock=os.path.join(os.path.dirname(root),'.'+p['id']+'.lock')
  fd=os.open(lock,os.O_CREAT|os.O_RDWR|os.O_NOFOLLOW,0o600)
  with os.fdopen(fd,'a') as locked:
   fcntl.flock(locked,fcntl.LOCK_EX)
   if not snapshot():
    if os.path.lexists(root): raise Exception('La carpeta de datos existe sin una migración válida')
    if source and not os.path.isdir(source): raise Exception('El directorio anterior no está disponible; no se cambió la ruta')
    stage=tempfile.mkdtemp(prefix='.'+p['id']+'-',dir=os.path.dirname(root)); files={}; total=[0]
    def copy(rel):
     src=checked(source,rel)
     if not os.path.lexists(os.path.join(source,rel)): return
     st=os.stat(src)
     if stat.S_ISDIR(st.st_mode):
      if os.path.islink(os.path.join(source,rel)): raise Exception('Directorio enlazado: requiere revisión antes de migrar')
      for name in sorted(os.listdir(src)): copy(rel+'/'+name)
     elif stat.S_ISREG(st.st_mode):
      data=read(src,limit if rel.endswith('.md') else 2*1024*1024); total[0]+=len(data)
      if len(files)>=2000 or total[0]>32*1024*1024: raise Exception('La configuración requiere una migración manual por su tamaño')
      dst=os.path.join(stage,rel); mode=0o700 if st.st_mode&0o111 else 0o600
      atomic(dst,data,mode)
      if read(dst,2*1024*1024)!=data: raise Exception('No se pudo verificar la copia')
      files[rel]={'sha256':digest(data),'mode':stat.S_IMODE(st.st_mode)}
     else: raise Exception('Tipo de archivo no admitido en la configuración')
    try:
     if source:
      for rel in ['CLAUDE.md','AGENTS.md','GEMINI.md','CLAUDE.local.md','MARKETPLACE.md','.mcp.json','.claude','.codex','.gemini']: copy(rel)
     # All providers start with the SAME preserved context when no native doc exists.
     active=os.path.join(stage,p['rel']); current=read(active) or b''; legacy=p.get('instructions','').strip().encode()
     if legacy and legacy not in current: current=legacy+b'\n\n'+current
     atomic(active,current)
     for rel in ['CLAUDE.md','AGENTS.md','GEMINI.md']:
      path=os.path.join(stage,rel); provider_doc=read(path)
      if provider_doc is None: atomic(path,current)
      elif legacy and legacy not in provider_doc: atomic(path,legacy+b'\n\n'+provider_doc)
     for rel,meta in files.items():
      if digest(read(checked(source,rel),2*1024*1024))!=meta['sha256']: raise Exception('La configuración cambió durante la migración; vuelve a intentarlo')
     manifest={'version':1,'projectId':p['id'],'sourcePath':source,'files':files}
     atomic(os.path.join(stage,'storage.json'),json.dumps(manifest).encode())
     os.rename(stage,root)
    finally:
     if os.path.exists(stage): shutil.rmtree(stage)
   if action=='write':
    dest=checked(root,p['rel']); old=read(dest) or b''
    if p.get('expectedHash') is not None and digest(old)!=p['expectedHash']: raise Exception('CONFLICT')
    content=p['content'].encode()
    if len(content)>limit: raise Exception('El documento supera el límite de 512 KB')
    atomic(dest,content,0o700 if p['rel'].endswith('.sh') else 0o600)
   result=inspect()
 print(json.dumps(result))
except Exception as e:
 print(json.dumps({'error':str(e)})); sys.exit(1)
`;

export interface ProjectStorageSnapshot {
  managed: boolean; root: string; storagePath: string; content: string; exists: boolean;
  manifest: { version: number; projectId: string; sourcePath: string; files: Record<string, { sha256: string; mode: number }> } | null;
}
export async function projectStorageOperation(executor: Executor, project: AssistantProject, action: "read" | "migrate" | "write", rel: string = PROJECT_DOCUMENTS[project.provider], extra: { content?: string; expectedHash?: string } = {}): Promise<ProjectStorageSnapshot> {
  assertProjectStorageAccess(project, action === "read" ? "read" : "write");
  const root = projectStorageRoot(project);
  if (project.path) {
    if (!project.path.startsWith("/") || project.path.includes("\0")) throw new ValidationError("Directorio de trabajo inválido.");
    const resolved = await executor.exec(`realpath -m -- ${quoteArg(project.path)}`, { timeoutMs: 10000 });
    const physical = resolved.stdout.trim();
    const user = getContextUser();
    if (resolved.exitCode !== 0 || !physical.startsWith("/") || !pathInFileJail(physical) || (user && !canAccessPath(user, physical, action === "read" ? "read" : "write"))) throw new ForbiddenError("No tienes acceso al directorio físico del proyecto.");
  }
  if (!rel || rel.startsWith("/") || rel.split("/").some(s => s === ".." || s === ".") || rel.includes("\0")) throw new ValidationError("Ruta de proyecto inválida.");
  const payload = JSON.stringify({ root, anchor: panelConfigDir(), id: project.id, source: project.path, instructions: project.instructions, action, rel, ...extra });
  const tmp = `/tmp/lxp-project-storage-${randomUUID()}.json`;
  const large = Buffer.byteLength(payload) > 24000;
  try {
    if (large) await executor.writeFile(tmp, payload, { encoding: "utf8", mode: 0o600 });
    const arg = large ? tmp : Buffer.from(payload).toString("base64");
    const result = await executor.exec(`python3 -c ${quoteArg(SCRIPT)} ${quoteArg(arg)}`, { timeoutMs: 30000 });
    let data: ProjectStorageSnapshot & { error?: string };
    try { data = JSON.parse(result.stdout); } catch { throw new ValidationError("No se pudo comprobar el almacenamiento del proyecto."); }
    if (data.error === "CONFLICT") throw new ConflictError("El contexto cambió. Vuelve a abrirlo antes de guardar.");
    if (result.exitCode !== 0 || data.error) throw new ValidationError(data.error || "No se pudo guardar el proyecto.");
    return data;
  } finally {
    if (large) await executor.exec(`rm -f -- ${quoteArg(tmp)}`, { timeoutMs: 5000 });
  }
}

export async function ensureProjectStorage(executor: Executor, project: AssistantProject) {
  return projectStorageOperation(executor, project, "migrate");
}
