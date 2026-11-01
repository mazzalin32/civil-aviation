import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { put, get, del } from "@vercel/blob";
import { env } from "../env";

/**
 * Private file storage. Local filesystem when no BLOB_READ_WRITE_TOKEN is set (dev);
 * Vercel Blob when it is (production — Vercel's filesystem is read-only outside a
 * per-invocation /tmp that isn't shared across instances, so local storage silently
 * loses every upload there). Swapping backend only ever means editing this one file —
 * nothing that calls putObject/getObject/deleteObject needs to change.
 *
 * Blobs are stored `access: "private"` — readable only with the store's token, never by
 * a bare URL — matching "never expose storage URLs; always go through the
 * permission-checked download route" (CLAUDE.md). The bytes are already envelope-encrypted
 * ciphertext before they ever reach this module either way.
 */
const useBlob = Boolean(env.BLOB_READ_WRITE_TOKEN);

function resolvePath(key: string): string {
  const root = path.resolve(env.DOCUMENT_STORAGE_DIR);
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export async function putObject(key: string, data: Buffer): Promise<void> {
  if (useBlob) {
    await put(key, data, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/octet-stream",
      token: env.BLOB_READ_WRITE_TOKEN,
    });
    return;
  }
  const full = resolvePath(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
}

export async function getObject(key: string): Promise<Buffer> {
  if (useBlob) {
    const result = await get(key, { access: "private", token: env.BLOB_READ_WRITE_TOKEN });
    if (!result?.stream) throw new Error(`Object not found: ${key}`);
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }
  return fs.readFile(resolvePath(key));
}

export async function deleteObject(key: string): Promise<void> {
  if (useBlob) {
    await del(key, { token: env.BLOB_READ_WRITE_TOKEN }).catch(() => {}); // already-gone is fine, same as fs.rm({force:true})
    return;
  }
  await fs.rm(resolvePath(key), { force: true });
}
