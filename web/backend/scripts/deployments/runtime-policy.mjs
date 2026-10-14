export function imageDigest(value) {
  const normalized = String(value).trim();
  if (!/^(?:sha256:)?[a-f0-9]{64}$/.test(normalized)) throw new Error('image_digest_invalid');
  return normalized.startsWith('sha256:') ? normalized : 'sha256:' + normalized;
}
