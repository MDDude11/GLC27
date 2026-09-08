import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = new URL("../dist/", import.meta.url);
const distPath = fileURLToPath(dist);
const requiredPages = [
  "index.html",
  "programme.html",
  "matches.html",
  "match.html",
  "scorer.html",
  "settings.html",
  "about.html",
  "404.html",
  "manifest.webmanifest",
  "sw.js"
];

for (const file of requiredPages) {
  try {
    await access(new URL(file, dist));
  } catch {
    throw new Error(`Build verification failed: dist/${file} is missing.`);
  }
}

const assets = await readdir(join(distPath, "assets"));
const jsAssets = assets.filter((file) => /\.js$/.test(file));
if (!jsAssets.length) throw new Error("Build verification failed: no JavaScript assets were emitted.");

for (const page of ["index.html", "programme.html", "matches.html", "match.html", "scorer.html", "settings.html", "about.html", "404.html"]) {
  const html = await readFile(new URL(page, dist), "utf8");
  if (!html.includes("type=\"module\"") && !html.includes("type='module'")) {
    throw new Error(`Build verification failed: ${page} has no module script.`);
  }
}

const scorerHtml = await readFile(new URL("scorer.html", dist), "utf8");
const scorerScript = scorerHtml.match(/<script[^>]+src=["']([^"']+)["']/i)?.[1];
if (!scorerScript) throw new Error("Build verification failed: scorer.html module script source is missing.");
if (/^https?:/i.test(scorerScript)) throw new Error("Build verification failed: scorer.html points directly to a remote script.");
const scorerAssetName = scorerScript.split("/").pop();
if (!scorerAssetName) throw new Error("Build verification failed: scorer script filename is empty.");
try {
  await access(join(distPath, "assets", scorerAssetName));
} catch {
  throw new Error(`Build verification failed: scorer script ${scorerScript} is missing from dist/assets/.`);
}

console.log(`Build verification passed: ${requiredPages.length} required public files and ${jsAssets.length} JS assets present; scorer entry resolves to a local built asset.`);
