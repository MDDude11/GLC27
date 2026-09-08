import { readFileSync, readdirSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let ts;
try { ts = require('typescript'); } catch { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js'); }

const root = fileURLToPath(new URL('../', import.meta.url));
const src = join(root, 'src');
const names = new Map();
for (const file of readdirSync(src)) {
  if (!['.js','.jsx'].includes(extname(file))) continue;
  const text = readFileSync(join(src,file),'utf8');
  const sf = ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
  const exported = new Set();
  for (const node of sf.statements) {
    if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      if (node.name?.text) exported.add(node.name.text);
      if (node.declarationList) for (const d of node.declarationList.declarations) if (d.name?.text) exported.add(d.name.text);
      if (node.kind === ts.SyntaxKind.ExportDeclaration && node.exportClause?.elements) for (const e of node.exportClause.elements) exported.add((e.propertyName || e.name).text);
    }
    if (node.kind === ts.SyntaxKind.ExportDeclaration && node.exportClause?.elements) for (const e of node.exportClause.elements) exported.add((e.propertyName || e.name).text);
  }
  names.set(join(src,file), exported);
}
const failures=[];
for (const [file] of names) {
  const sf=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  for (const node of sf.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const spec=node.moduleSpecifier.text;
    if (!spec.startsWith('.') || /\.css$|\.scss$|\.svg$|\.png$/.test(spec)) continue;
    let target=resolve(dirname(file),spec);
    if (!extname(target)) {
      if (names.has(target+'.js')) target += '.js'; else if (names.has(target+'.jsx')) target += '.jsx';
    }
    const exports=names.get(target);
    if (!exports) { failures.push(`${file}: unresolved local module ${spec}`); continue; }
    if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
      for (const el of node.importClause.namedBindings.elements) {
        const imported=(el.propertyName||el.name).text;
        if (!exports.has(imported)) failures.push(`${file}: imports missing named export ${imported} from ${spec}`);
      }
    }
  }
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`Local named-import check passed for ${names.size} source files.`);
