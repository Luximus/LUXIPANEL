import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatPermissionLabel } from './permission-labels';
import { permissionLabelMessages } from './permission-label-messages';
import { renderPolicyMatrix, collectPolicyMatrix } from '../scripts/extracted/lib/permission-editor';
import { moduleActionIds } from '../../../backend/src/shared/auth/module-actions';
const source = readFileSync('../backend/src/modules/auth/services/role-permissions.service.ts', 'utf8');
function ids(name: string) { const start = source.indexOf(`export const ${name}`); const equals = source.indexOf('=', start); return [...source.slice(source.indexOf('[', equals), source.indexOf('];', equals)).matchAll(/"([^"]+)"/g)].map(m => m[1]); }
const modules = ['users','files','terminal','mail','dns','backups','databases','cron','assistant','expo','repository-store','monitor','hosting','server-switcher','module-dev','settings','preferences','firewall','bitninja','webhooks','cloudflare','obsidian','openclaw','codebase-graph','project-map','notifications','chat'];
const special = {users:ids('USER_ACTION_IDS'),files:ids('FILE_ACTION_IDS'),terminal:ids('TERMINAL_ACTION_IDS')};
const catalog = {modules:modules.map(module=>({module,label:module,sidebar:[module],views:[`panel.${module}`],actions:special[module as keyof typeof special] ?? moduleActionIds(module)})),commandGroups:Object.keys(permissionLabelMessages.es.commandGroups),actionMetadata:{'files.chmod':{adminOnly:true,labelKey:'chmod'}}};
describe('permission descriptions across the real permission catalog',()=>{
  for (const [locale,messages] of Object.entries(permissionLabelMessages)) it(`describes distinct permissions and scopes in ${locale}`,()=>{
    expect(special.users).toHaveLength(8); expect(special.files.length).toBeGreaterThan(25);
    for(const module of catalog.modules){const labels=module.actions.map(id=>formatPermissionLabel(id,catalog,messages,'actions'));expect(new Set(labels).size,`${locale}/${module.module}: ${labels}`).toBe(labels.length);for(const field of ['sidebar','views','actions'] as const)for(const id of module[field]){const label=formatPermissionLabel(id,catalog,messages,field);expect(label).not.toBe(id);expect(label).not.toMatch(/\{\w+\}/);}}
    expect(formatPermissionLabel('users',catalog,messages,'commands')).not.toBe(formatPermissionLabel('users',catalog,messages,'sidebar'));
  });
  it('distinguishes users, groups, file content and columns in Spanish',()=>{
    const label=(id:string)=>formatPermissionLabel(id,catalog,permissionLabelMessages.es,'actions');
    expect(label('users.delete')).toBe('Eliminar usuarios');expect(label('roles.delete')).toBe('Eliminar grupos');expect(label('files.read')).toBe('Leer el contenido de archivos');expect(label('files.col.perms')).toContain('columna');
  });
  it('preserves saved IDs and administrator restrictions when changing labels',()=>{
    document.documentElement.lang='es';const root=document.createElement('div');const policy={sidebar:['users'],views:['panel.users'],actions:['users.delete','roles.view']};renderPolicyMatrix(root,catalog,policy,true);
    expect(collectPolicyMatrix(root)).toEqual({version:2,...policy});expect(root.querySelector<HTMLInputElement>('input[value="files.chmod"]')?.disabled).toBe(true);
    root.querySelector<HTMLInputElement>('input[value="roles.delete"]')!.checked=true;expect(collectPolicyMatrix(root).actions).toEqual(['users.delete','roles.view','roles.delete']);
  });
});
