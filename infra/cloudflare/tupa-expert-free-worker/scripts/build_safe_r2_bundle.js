import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePublic = path.join(root, "public");
const targetPublic = path.join(root, "public_safe");
const embeddedAssetsPath = path.join(root, "src", "embedded_safe_assets.js");

function copyDir(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) copyDir(sourcePath, targetPath);
    if (entry.isFile()) fs.copyFileSync(sourcePath, targetPath);
  }
}

function collectFiles(dir, prefix = "") {
  const files = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) Object.assign(files, collectFiles(absolute, relative));
    if (entry.isFile()) files[relative] = fs.readFileSync(absolute, "utf8");
  }
  return files;
}

copyDir(sourcePublic, targetPublic);

const embeddedAssets = collectFiles(targetPublic);
const embeddedModule = [
  "export const SAFE_SNAPSHOT = null;\n",
  "export const EMBEDDED_SAFE_ASSETS = ",
  JSON.stringify(embeddedAssets, null, 2),
  ";\n",
].join("");

fs.writeFileSync(embeddedAssetsPath, embeddedModule, "utf8");
console.log(`safe_bundle=${targetPublic}`);
console.log(`embedded_assets=${Object.keys(embeddedAssets).length}`);
