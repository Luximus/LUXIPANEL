const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'../..');const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const module={exports:{}};cache.set(file,module.exports);const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',js)(name=>load(path.resolve(path.dirname(file),name+'.ts')),module,module.exports);return module.exports;}
const base=path.join(root,'src/screens/server/native-extras');
const definitions={...load(base+'/administration.ts').administrationExtras,...load(base+'/services.ts').serviceExtras,files:load(base+'/files.ts').filesExtras};
const contracts=[...JSON.parse(fs.readFileSync(root+'/.cache/module-functional-audit/server-operations.json')),...JSON.parse(fs.readFileSync(root+'/.cache/module-functional-audit/backend-routes.json'))];
const pattern=route=>new RegExp('^'+route.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/:[\w]+/g,'[^/]+')+'/?$');
const rows=[];
for(const[module,groups]of Object.entries(definitions))for(const group of groups)for(const op of group.operations){
 const values={...op.initial};for(const field of op.fields||[])values[field.key]??=field.type==='boolean'?false:field.type==='lines'?['audit-fixture']:field.type==='number'?field.min??1:field.options?.[0]?.key??'audit-fixture';
 const routes=[];if(op.readPath)routes.push(['GET',op.readPath]);if(op.path)routes.push([op.method??'PUT',typeof op.path==='function'?op.path(values):op.path]);
 for(const[method,route]of routes){const found=contracts.some(c=>{const[m,p]=c.route.split(' ');return m===method&&pattern(p).test(route.split('?')[0]);});rows.push({module,group:group.title,title:op.title,method,route,status:found?'route-matched':'review-backend',fields:(op.fields||[]).map(f=>f.key)});}
}
console.log(JSON.stringify({operations:Object.values(definitions).flat().reduce((n,g)=>n+g.operations.length,0),rows},null,2));
