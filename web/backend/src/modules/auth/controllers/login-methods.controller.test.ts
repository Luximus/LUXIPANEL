import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
 local: {target: {id: 'local'}}, read: vi.fn(), write: vi.fn(), mirror: vi.fn(), login: vi.fn(), captcha: vi.fn(),
}));
vi.mock('../../../shared/executor/index.js', () => ({
 localExecutor: m.local, getExecutor: () => m.local, getExecutorForRead: () => m.local,
 getContextExecutor: () => null, runWithExecutor: (_e: unknown, fn: () => unknown) => fn(),
}));
vi.mock('../../../shared/remote-config/index.js', () => ({remoteConfig: {read: m.read, write: m.write}}));
vi.mock('../../../shared/logger/index.js', () => ({createModuleLogger: () => ({warn: vi.fn(), error: vi.fn()})}));
vi.mock('../../../shared/events/index.js', () => ({eventBus: {emit: vi.fn()}, Events: {SETTINGS_UPDATED: 'settings'}}));
vi.mock('../../admin/repositories/index.js', () => ({settingsRepository: {}}));
vi.mock('../../admin/services/server-settings.service.js', () => ({serverSettingsService: {setBulk: m.mirror, setOne: m.mirror}}));
vi.mock('../services/auth.service.js', () => ({authService: {loginLocal: m.login, buildLoginResponse: vi.fn(async () => ({}))}}));
vi.mock('../services/hcaptcha.service.js', () => ({hcaptchaService: {verify: m.captcha}}));
let app: express.Express;
let stored: Record<string, unknown>;
beforeEach(async () => {
 vi.resetModules(); vi.clearAllMocks();
 stored = {loginAllowPassword: false, loginAllowPasskey: true, loginAllowRecovery: false};
 m.read.mockImplementation(async () => ({...stored}));
 m.write.mockImplementation(async (_e: unknown, _name: string, data: Record<string, unknown>) => {stored = {...data};});
 const {loginController} = await import('./login.controller.js');
 const {settingsController} = await import('../../admin/controllers/settings.controller.js');
 app = express(); app.use(express.json());
 app.get('/methods', loginController.getLoginMethods);
 app.post('/login', loginController.login);
 app.put('/settings', settingsController.set);
 app.put('/settings/bulk', settingsController.setBulk);
 app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(err.statusCode ?? 500).json({ok: false, code: err.code}));
});
describe('login policy endpoints', () => {
 it('rejects password login before attempting Linux authentication', async () => {
  const response = await request(app).post('/login').send({user:'test', pass:'test'});
  expect(response.status).toBe(403);
  expect(response.body.code).toBe('PASSWORD_LOGIN_DISABLED');
  expect(m.login).not.toHaveBeenCalled(); expect(m.captcha).not.toHaveBeenCalled();
 });
 it('returns only enabled public methods without caching', async () => {
  const response = await request(app).get('/methods');
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body.data).toMatchObject({password:false, passkey:true, recovery:false});
 });
 it('rejects unchecking the last method through a single update', async () => {
  const response = await request(app).put('/settings').send({key:'login_allow_passkey', value:'false'});
  expect(response.status).toBe(400); expect(response.body.code).toBe('VALIDATION_ERROR');
  expect(m.write).not.toHaveBeenCalled(); expect(m.mirror).not.toHaveBeenCalled();
 });
 it('rejects an empty bulk selection without saving any keys or reporting a connection failure', async () => {
  const settings = ['password','passkey','recovery'].map(m => ({key:`login_allow_${m}`, value:'false'}));
  const response = await request(app).put('/settings/bulk').send({settings:[...settings, {key:'panel_name',value:'test'}]});
  expect(response.status).toBe(400); expect(response.body.code).toBe('VALIDATION_ERROR');
  expect(m.write).not.toHaveBeenCalled(); expect(m.mirror).not.toHaveBeenCalled();
 });
 it('publishes a valid method switch immediately on the public endpoint', async () => {
  await request(app).get('/methods');
  const response = await request(app).put('/settings/bulk').send({settings:[{key:'login_allow_passkey',value:'false'},{key:'login_allow_recovery',value:'true'}]});
  expect(response.status).toBe(200); expect(m.mirror).toHaveBeenCalledOnce();
  expect((await request(app).get('/methods')).body.data).toMatchObject({password:false,passkey:false,recovery:true});
 });
});
