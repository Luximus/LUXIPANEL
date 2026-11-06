import { readdir } from 'node:fs/promises';
export function imageDigest(value) {
  const normalized = String(value).trim();
  if (!/^(?:sha256:)?[a-f0-9]{64}$/.test(normalized)) throw new Error('image_digest_invalid');
  return normalized.startsWith('sha256:') ? normalized : 'sha256:' + normalized;
}


/** A failed first build may never have created any owned service definitions. */
export async function optionalDirectoryEntries(directory, readDirectory = readdir) {
  try { return await readDirectory(directory); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
