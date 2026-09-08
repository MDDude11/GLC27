import { readFile, readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
let ts;
try {
  ts = require("typescript");
} catch {
  try {
    ts = require("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js");
  } catch {
    console.error("TypeScript parser is unavailable. Run npm ci before linting.");
    process.exit(1);
  }
}

const root = fileURLToPath(new URL("../", import.meta.url));
const source = join(root, "src");
const files = (await readdir(source)).filter((name) => [".js", ".jsx"].includes(extname(name)));
const failures = [];

for (const name of files) {
  const path = join(source, name);
  const text = await readFile(path, "utf8");
  const result = ts.transpileModule(text, {
    fileName: name,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      allowJs: true,
      sourceMap: false
    }
  });
  for (const diagnostic of result.diagnostics || []) {
    failures.push(`${name}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`);
  }
  if (/TODO\(lint\)|<<<<<<<|=======|>>>>>>>/.test(text)) {
    failures.push(`${name}: unresolved merge marker or temporary lint marker found`);
  }
}

const packageText = await readFile(join(root, "package.json"), "utf8");
const pkg = JSON.parse(packageText);
for (const required of ["dev", "build", "lint"]) {
  if (!pkg.scripts?.[required]) failures.push(`package.json: missing npm script '${required}'`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Static JSX/JS lint passed for ${files.length} source files.`);
