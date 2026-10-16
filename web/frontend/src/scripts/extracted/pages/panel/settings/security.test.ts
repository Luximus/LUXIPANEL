
import {beforeEach, afterEach, describe, it, expect, vi} from 'vitest';
const mocks=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),patch:vi.fn(),prompt:vi.fn(),toast:vi.fn(),scope:'server-a'}));
vi.mock('/scripts/extracted/lib/api-client.js?v=20260506a',()=>({api:{get:mocks.get,post:mocks.post,patch:mocks.patch},resolveTargetScope:()=>mocks.scope}));
vi.mock('/scripts/extracted/lib/confirm.js?v=3',()=>({openConfirm:vi.fn(),openPrompt:mocks.prompt}));
vi.mock('/scripts/extracted/vendor/qrcode-browser.js?v=2',()=>({default:{toCanvas:vi.fn()}}));
vi.mock('/scripts/extracted/lib/dom.js',()=>({openDialog:vi.fn()}));
vi.mock('./dom',()=>({t:(_key:string,fallback:string)=>fallback,fmt:(s:string,v:Record<string,unknown>)=>s.replace(/\{(\w+)\}/g,(_,k)=>String(v[k])),showToast:mocks.toast}));
vi.mock('./tabs',()=>({bumpSecurityBadge:vi.fn()}));

beforeEach(()=>{
 vi.resetModules();vi.clearAllMocks();mocks.scope='server-a';
 delete (window as any).__LUXIPANEL_CAN_MANAGE_LOCAL_AUTH__;
 document.body.innerHTML='<main id="settings-content"><span id="passkey-status-text"></span><button id="btn-manage-passkeys"></button><span id="recovery-status-text"></span><button id="btn-manage-recovery"></button><span id="s-self-2fa-badge"></span><p id="s-self-2fa-text"></p><button id="btn-setup-2fa-settings"></button><button id="btn-disable-2fa-settings"></button><button id="btn-deactivate-2fa-settings"></button></main>';
 mocks.get.mockImplementation(async(path:string)=>({ok:true,data:path.endsWith('/passkeys')?[]:path.endsWith('/recovery/status')?{hasActiveCodes:false}:{configured:false,enabled:false}}));
});
afterEach(()=>{delete (window as any).__LUXIPANEL_CAN_MANAGE_LOCAL_AUTH__;});

describe('settings security availability',()=>{
 it.each([undefined,false])('loads the user security without the obsolete global (%s)',async(value)=>{
  (window as any).__LUXIPANEL_CAN_MANAGE_LOCAL_AUTH__=value;
  const security=await import('./security');
  await Promise.all([security.loadAuthMethodStatus(),security.load2FAStatusSettings()]);
  expect(mocks.get.mock.calls.map(([path])=>path).sort()).toEqual(['/api/auth/passkeys','/api/auth/recovery/status','/api/auth/totp/status'].sort());
  expect(document.getElementById('btn-manage-passkeys')?.textContent).toBe('Configurar');
  expect(document.getElementById('btn-manage-recovery')?.textContent).toBe('Generar');
  expect((document.getElementById('btn-setup-2fa-settings') as HTMLButtonElement).disabled).toBe(false);
  expect(document.body.textContent).not.toContain('LP-LICENSE-SERVER');
 });
 it('supports importing controllers before workspace initialization',async()=>{
  const security=await import('./security');
  (window as any).__LUXIPANEL_CAN_MANAGE_LOCAL_AUTH__=true;
  await security.load2FAStatusSettings();
  expect(mocks.get).toHaveBeenCalledWith('/api/auth/totp/status');
  expect(document.getElementById('s-self-2fa-text')?.textContent).toContain('Activa 2FA');
 });
 it('displays configured methods from the authenticated API',async()=>{
  mocks.get.mockImplementation(async(path:string)=>({ok:true,data:path.endsWith('/passkeys')?[{id:'test'}]:path.endsWith('/recovery/status')?{hasActiveCodes:true}:{configured:true,enabled:true}}));
  const security=await import('./security');
  await Promise.all([security.loadAuthMethodStatus(),security.load2FAStatusSettings()]);
  expect(document.getElementById('passkey-status-text')?.textContent).toContain('1 passkey');
  expect(document.getElementById('recovery-status-text')?.textContent).toContain('generados');
  expect(document.getElementById('s-self-2fa-badge')?.textContent).toBe('Activado');
  expect(document.getElementById('btn-setup-2fa-settings')?.classList.contains('hidden')).toBe(true);
  expect(mocks.post).not.toHaveBeenCalled();
 });
 it('discards status returned after switching servers',async()=>{
  let resolve!:(result:unknown)=>void;mocks.get.mockReturnValue(new Promise(r=>{resolve=r;}));
  const security=await import('./security');const loading=security.load2FAStatusSettings();
  mocks.scope='server-b';resolve({ok:true,data:{configured:true,enabled:true}});await loading;
  expect(document.getElementById('s-self-2fa-badge')?.textContent).toBe('');
 });
});


describe('settings passkey list', () => {
 beforeEach(() => {
  document.documentElement.lang = 'es';
  document.body.innerHTML += '<div id="passkeys-settings-skeleton"></div><div id="passkeys-settings-list" class="hidden"></div><p id="passkeys-settings-empty" class="hidden"></p>';
 });
 const render = async (passkey: Record<string, unknown>) => {
  mocks.get.mockResolvedValue({ok: true, data: [{id: 'test-passkey', ...passkey}]});
  const security = await import('./security');
  await security.loadPasskeysSettings();
  return document.getElementById('passkeys-settings-list')!;
 };
 it('renders the current API label and createdAt after registration', async () => {
  const createdAt = '2026-10-13T18:30:00.000Z';
  const list = await render({label: 'Mi teléfono', createdAt});
  expect(list.querySelector('p')?.textContent).toBe('Mi teléfono');
  expect(list.textContent).toContain('Registrada ' + new Date(createdAt).toLocaleDateString('es'));
  expect(list.classList.contains('hidden')).toBe(false);
  expect(document.getElementById('passkeys-settings-skeleton')?.classList.contains('hidden')).toBe(true);
 });
 it('supports previous field names from older targets', async () => {
  const created_at = '2025-06-10T18:30:00.000Z';
  const list = await render({name: 'Anterior', created_at});
  expect(list.textContent).toContain('Anterior');
  expect(list.textContent).toContain(new Date(created_at).toLocaleDateString('es'));
 });
 it.each([undefined, null, '', 'not-a-date', 0])('does not invent a registration date for %s', async createdAt => {
  const list = await render({createdAt});
  expect(list.textContent).toContain('Registrada —');
  expect(list.textContent).not.toContain('Invalid Date');
 });
 it('prefers the current API fields and displays labels as text', async () => {
  const label = '<img src=x onerror=alert(1)> & dispositivo';
  const list = await render({label, name: 'Anterior', createdAt: '2026-10-13T18:30:00Z', created_at: '2020-01-01'});
  expect(list.querySelector('p')?.textContent).toBe(label);
  expect(list.querySelector('img')).toBeNull();
  expect(list.textContent).not.toContain('2020');
 });
});

describe('passkey display names', () => {
 beforeEach(() => {
  mocks.prompt.mockResolvedValue(null);
  mocks.patch.mockResolvedValue({ok:true,data:{label:'Personal laptop'}});
  document.body.innerHTML += '<div id="passkeys-settings-skeleton"></div><div id="passkeys-settings-list" class="hidden"></div><p id="passkeys-settings-empty" class="hidden"></p>';
 });
 it('saves a trimmed name and reloads the passkeys', async () => {
  mocks.prompt.mockResolvedValue('  Personal laptop  ');
  const security = await import('./security');
  await security.renamePasskeySettings('key/1', 'Old name');
  expect(mocks.prompt).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({defaultValue:'Old name'}));
  expect(mocks.patch).toHaveBeenCalledWith('/api/auth/passkeys/key%2F1', {label:'Personal laptop'});
  expect(mocks.get).toHaveBeenCalledWith('/api/auth/passkeys');
 });
 it.each([null,'Old name','   ','x'.repeat(129)])('does not save canceled, unchanged or invalid names (%s)', async value => {
  mocks.prompt.mockResolvedValue(value);
  const security = await import('./security');
  await security.renamePasskeySettings('key-1','Old name');
  expect(mocks.patch).not.toHaveBeenCalled();
 });
 it('does not rename a credential after switching targets during the prompt', async () => {
  mocks.prompt.mockImplementation(async () => {mocks.scope='server-b';return 'New name';});
  const security = await import('./security');
  await security.renamePasskeySettings('key-1','Old name');
  expect(mocks.patch).not.toHaveBeenCalled();
 });
 it('shows a labeled edit action and keeps a failed save visible as an error', async () => {
  mocks.get.mockResolvedValue({ok:true,data:[{id:'key-1',label:'My laptop',createdAt:'2026-10-14T00:00:00Z'}]});
  const security = await import('./security');
  await security.loadPasskeysSettings();
  const button=document.querySelector<HTMLButtonElement>('.btn-rename-passkey-settings')!;
  expect(button.getAttribute('aria-label')).toBe('Editar nombre');
  mocks.prompt.mockResolvedValue('New name');mocks.patch.mockResolvedValue({ok:false,error:'failure'});
  button.click();
  await vi.waitFor(()=>expect(mocks.toast).toHaveBeenCalledWith('No se pudo guardar el nombre.',false));
  expect(button.disabled).toBe(false);
  expect(document.querySelector('#passkeys-settings-list p')?.textContent).toBe('My laptop');
 });
 it('includes the chosen label when registering a credential', async () => {
  const original=Object.getOwnPropertyDescriptor(navigator,'credentials');
  Object.defineProperty(navigator,'credentials',{configurable:true,value:{create:vi.fn().mockResolvedValue({
   id:'new-key',type:'public-key',rawId:new ArrayBuffer(1),response:{attestationObject:new ArrayBuffer(1),clientDataJSON:new ArrayBuffer(1),getTransports:()=>[]},getClientExtensionResults:()=>({})
  })}});
  try {
   mocks.prompt.mockResolvedValue('Work computer');
   mocks.post.mockImplementation(async (path:string)=>({ok:true,data:path.endsWith('register-options')?{challenge:'AA',user:{id:'AA'}}:{}}));
   const security=await import('./security');await security.registerPasskeyFromSettings();
   expect(mocks.post).toHaveBeenCalledWith('/api/auth/passkeys/register-verify',expect.objectContaining({label:'Work computer',response:expect.any(Object)}));
  } finally {if(original)Object.defineProperty(navigator,'credentials',original);else delete (navigator as any).credentials;}
 });
});


describe('login method selection', () => {
 const methods = ['password', 'passkey', 'recovery'];
 function checks() {return Array.from(document.querySelectorAll<HTMLInputElement>('.login-method-check'));}
 beforeEach(() => {
  document.body.innerHTML += methods.map(m => `<input type="checkbox" class="login-method-check" id="s-login-allow-${m}">`).join('') + '<p id="login-methods-warning" class="hidden"></p>';
 });
 it.each([1, 2, 3, 4, 5, 6, 7])('keeps the selection and disables only the last active method (mask %s)', async mask => {
  const {enforceAtLeastOneMethod} = await import('./security');
  checks().forEach((c, i) => {c.checked = Boolean(mask & (1 << i)); c.disabled = true;});
  enforceAtLeastOneMethod();
  const count = checks().filter(c => c.checked).length;
  checks().forEach((c, i) => {expect(c.checked).toBe(Boolean(mask & (1 << i))); expect(c.disabled).toBe(count === 1 && c.checked);});
 });
 it('unlocks the previous sole method when another one is selected', async () => {
  const {enforceAtLeastOneMethod} = await import('./security'); const [password, passkey] = checks();
  passkey.checked = true; enforceAtLeastOneMethod(); expect(passkey.disabled).toBe(true);
  password.checked = true; enforceAtLeastOneMethod(); expect(passkey.disabled).toBe(false);
  passkey.checked = false; enforceAtLeastOneMethod(); expect(password.disabled).toBe(true); expect(passkey.disabled).toBe(false);
 });
 it('restores only the last unchecked method without enabling the others', async () => {
  const {enforceAtLeastOneMethod} = await import('./security'); const passkey = checks()[1];
  passkey.addEventListener('change', enforceAtLeastOneMethod); passkey.dispatchEvent(new Event('change'));
  expect(checks().map(c => c.checked)).toEqual([false, true, false]); expect(passkey.disabled).toBe(true);
  expect(document.getElementById('login-methods-warning')?.classList.contains('hidden')).toBe(false);
 });
});
