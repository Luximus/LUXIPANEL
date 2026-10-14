import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageDigest } from './runtime-policy.mjs';
test('Podman IDs remain immutable with or without the sha256 prefix', () => {
  const id = 'a'.repeat(64);
  assert.equal(imageDigest(id), 'sha256:' + id);
  assert.equal(imageDigest('sha256:' + id + '\n'), 'sha256:' + id);
  for (const value of ['latest', 'docker.io/library/node:22', 'sha256:abc', 'sha512:' + id]) {
    assert.throws(() => imageDigest(value), /image_digest_invalid/);
  }
});
