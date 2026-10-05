import { rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const projectRoot = resolve(process.cwd());
const cachePath = resolve(projectRoot, ".next");

if (dirname(cachePath) !== projectRoot || basename(cachePath) !== ".next") {
  throw new Error("Refusing to clean an unexpected Next.js cache path.");
}

await rm(cachePath, { recursive: true, force: true });
