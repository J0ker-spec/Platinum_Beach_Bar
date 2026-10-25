import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = path.join(projectRoot, "dist");
const htmlPath = path.join(distDirectory, "index.html");
const manifestPath = path.join(distDirectory, "manifest.json");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const requiredFiles = [
  "icons/apple-touch-icon.png",
  ...manifest.icons.map(({ src }) => src.replace(/^\//, "")),
];

for (const file of requiredFiles) {
  await readFile(path.join(distDirectory, file));
}

let html = await readFile(htmlPath, "utf8");
const pwaTags = [
  ['<meta name="theme-color" content="#F7F8FC" />', /<meta\b(?=[^>]*\bname=["']theme-color["'])/i],
  ['<meta name="mobile-web-app-capable" content="yes" />', /<meta\b(?=[^>]*\bname=["']mobile-web-app-capable["'])/i],
  ['<meta name="apple-mobile-web-app-capable" content="yes" />', /<meta\b(?=[^>]*\bname=["']apple-mobile-web-app-capable["'])/i],
  ['<meta name="apple-mobile-web-app-title" content="PlatinumX" />', /<meta\b(?=[^>]*\bname=["']apple-mobile-web-app-title["'])/i],
  ['<meta name="apple-mobile-web-app-status-bar-style" content="default" />', /<meta\b(?=[^>]*\bname=["']apple-mobile-web-app-status-bar-style["'])/i],
  ['<link rel="manifest" href="/manifest.json" />', /<link\b(?=[^>]*\brel=["']manifest["'])/i],
  ['<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />', /<link\b(?=[^>]*\brel=["']apple-touch-icon["'])/i],
];

const missingTags = pwaTags
  .filter(([, matcher]) => !matcher.test(html))
  .map(([tag]) => tag);
const headClose = html.search(/<\/head>/i);

if (headClose < 0) {
  throw new Error(`Cannot add PWA metadata: no closing </head> tag in ${htmlPath}`);
}

if (missingTags.length > 0) {
  html = `${html.slice(0, headClose)}${missingTags.join("\n  ")}\n  ${html.slice(headClose)}`;
  await writeFile(htmlPath, html);
}

console.log(`Verified PWA metadata and icons in ${distDirectory}`);
