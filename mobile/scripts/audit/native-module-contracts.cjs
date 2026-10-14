// Read-only inventory. Route matches prove wiring only, not a successful server mutation.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, '.cache/module-functional-audit/server-operations.json')));
const routePattern = route => new RegExp('^' + route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:[\w]+/g, '[^/]+') + '/?$');
const declarations = JSON.parse(fs.readFileSync(path.join(root,'.cache/module-functional-audit/backend-routes.json')));
const contracts = [...catalog,...declarations].map(entry => ({...entry, method:entry.route.split(' ')[0], pattern:routePattern(entry.route.split(' ')[1])}));
const files = dir => fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? files(path.join(dir,e.name)) : /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [path.join(dir,e.name)] : []);
const result=[];
for(const file of [...files(path.join(root,'src/screens/server')), ...files(path.join(root,'src/api'))]) {
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 function visit(node) {
  if(ts.isCallExpression(node) && (node.expression.getText(source)==='callServerApi' || (node.arguments[0] && ts.isStringLiteralLike(node.arguments[0]) && /^(GET|POST|PUT|PATCH|DELETE)$/.test(node.arguments[0].text)))) {
   const offset=node.expression.getText(source)==='callServerApi'?2:0;
   const method=node.arguments[offset], route=node.arguments[offset+1];
   if(route) {
    let endpoint=ts.isStringLiteralLike(route)?route.text:ts.isTemplateExpression(route)?route.head.text+route.templateSpans.map(span=>'__value__'+span.literal.text).join(''):null;
    const verb=method&&ts.isStringLiteralLike(method)?method.text:null;
    const match=endpoint&&verb?contracts.filter(c=>c.method===verb&&c.pattern.test(endpoint.split('?')[0])):[];
    result.push({file:path.relative(root,file),line:source.getLineAndCharacterOfPosition(node.getStart()).line+1,method:verb||method?.getText(source),path:endpoint||route.getText(source),status:!endpoint||!verb?'dynamic-review':match.length?'route-matched':'route-not-in-catalog',modules:[...new Set(match.map(c=>c.module))],evidence:match[0]?.file??match[0]?.tool});
   }
  }
  ts.forEachChild(node,visit);
 } visit(source);
}
console.log(JSON.stringify({summary:result.reduce((acc,r)=>(acc[r.status]=(acc[r.status]||0)+1,acc),{}),calls:result},null,2));
