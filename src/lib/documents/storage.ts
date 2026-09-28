import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { env } from "../env";

/**
 * Private file storage, local-filesystem today. Swapping in real S3-compatible object
 * storage later only means rewriting this one file — nothing that calls it needs to change.
 * Never expose these paths directly; every read goes through a permission-checked route.
 */
function resolvePath(key: string): string {
  const root = path.resolve(env.DOCUMENT_STORAGE_DIR);
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export async function putObject(key: string, data: Buffer): Promise<void> {
  const full = resolvePath(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
}

export async function getObject(key: string): Promise<Buffer> {
  return fs.readFile(resolvePath(key));
}

export async function deleteObject(key: string): Promise<void> {
  await fs.rm(resolvePath(key), { force: true });
}
