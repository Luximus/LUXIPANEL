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

/** Previous previews are retired only after the supervisor accepts the candidate. */
export async function finalizePreview(io, currentId) {
  const current = await io.read(currentId);
  if (!current || current.environment !== 'preview') throw new Error('preview_job_missing');
  const kept = new Set(current.units ?? []);
  const evicted = new Set(current.result?.evictedVersionIds ?? []);
  for (const id of await io.list()) {
    if (id === currentId) continue;
    const previous = await io.read(id);
    if (previous?.environment !== 'preview') continue;
    for (const unit of previous.units ?? []) if (!kept.has(unit)) await io.stop(unit);
    if (previous.result?.versionId) evicted.add(previous.result.versionId);
    current.result = { ...current.result, evictedVersionIds: [...evicted] };
    await io.write(currentId, current);
    await io.remove(id);
  }
  return { evictedVersionIds: [...evicted] };
}

export async function discardCandidate(io, currentId, candidateUnits) {
  const current = await io.read(currentId);
  const kept = new Set(await io.activeUnits());
  for (const id of await io.list()) {
    if (id === currentId) continue;
    const previous = await io.read(id);
    for (const unit of previous?.units ?? []) kept.add(unit);
  }
  for (const unit of candidateUnits ?? current?.units ?? []) if (!kept.has(unit)) await io.stop(unit);
  if (current) await io.remove(currentId);
}
