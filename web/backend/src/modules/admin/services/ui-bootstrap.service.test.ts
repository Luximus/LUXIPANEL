import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({load:vi.fn()}));
vi.mock("./module-registry.service.js",()=>({moduleRegistryService:{getEnabledMap:async()=>({assistant:true,files:true}),getOrder:async()=>['files','assistant'],getDisplayMap:async()=>({files:{showInSidebar:true}}),getAll:()=>[{id:'files',name:'Files'},{id:'assistant',name:'AI'}]}}));
vi.mock("../repositories/settings.repository.js",()=>({settingsRepository:{getByCategory:async()=>[{key:'layout_logo',value:'/branding/logo.png'}]}}));
vi.mock("../../users/services/users.service.js",()=>({usersService:{getPreferences:async()=>({theme:'dark',language:'es'})}}));
vi.mock("../../ai-assistant/repositories/assistant-config.repository.js",()=>({assistantConfigRepository:{load:m.load}}));
vi.mock("../controllers/layout.controller.js",()=>({layoutAssetPath:()=>'/branding/logo.png'}));
import {loadUiBootstrap} from './ui-bootstrap.service.js';
import {defaultAssistantConfig} from '../../ai-assistant/models/assistant-config.types.js';
const user={userId:1,username:'alice',kind:'admin',modules:[]};
beforeEach(()=>{m.load.mockReset();const config=defaultAssistantConfig();Object.values(config.providers)[0]!.api.apiKey='secret-must-not-be-in-SSR';m.load.mockResolvedValue(config)});
it('preserves menu order, scopes remote branding, and excludes provider credentials',async()=>{
 const result=await loadUiBootstrap(user as never,{target:{id:'remote'}} as never);
 expect(result.modules.map(m=>m.id)).toEqual(['files','assistant']);expect(result.layout.layout_logo).toContain('target=remote');
 expect(JSON.stringify(result)).not.toContain('secret-must-not-be-in-SSR');expect(result.assistant).not.toBeNull();
});
it('does not read assistant configuration without module/view/action access',async()=>{
 const result=await loadUiBootstrap({...user,kind:'user',permissions:{views:[],actions:[],sidebar:[]}} as never,{target:{id:'local'}} as never);
 expect(result.assistant).toBeNull();expect(m.load).not.toHaveBeenCalled();
});
it('keeps the shell available when optional assistant configuration fails',async()=>{
 m.load.mockRejectedValue(new Error('temporarily unavailable'));
 const result=await loadUiBootstrap(user as never,{target:{id:'local'}} as never);expect(result.modules).toHaveLength(2);expect(result.assistant).toBeNull();
});
