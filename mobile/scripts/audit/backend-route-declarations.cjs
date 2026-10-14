const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const base=require('node:path').resolve(__dirname,'../../../web/backend/src');
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):e.name.endsWith('.ts')&&!e.name.includes('.test.')?[path.join(dir,e.name)]:[]);
const rows=[];
for(const file of files(base)) {

 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 function visit(node){
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&/^(get|post|put|patch|delete)$/.test(node.expression.name.text)&&node.arguments[0]&&ts.isStringLiteralLike(node.arguments[0])){
   let endpoint=node.arguments[0].text;
   if(!endpoint.startsWith('/api/')&&file.includes('/security-audit/'))endpoint='/api/security-audit'+endpoint;
   if(!endpoint.startsWith('/api/')&&file.includes('/ai-assistant/'))endpoint='/api/ai'+endpoint;
   if(endpoint.startsWith('/api/'))rows.push({module:path.relative(base,file).split('/')[1],route:node.expression.name.text.toUpperCase()+' '+endpoint,file,line:source.getLineAndCharacterOfPosition(node.getStart()).line+1,kind:'backend-declaration',revision:'source'});
  }ts.forEachChild(node,visit);
 }visit(source);
}
console.log(JSON.stringify(rows,null,2));
