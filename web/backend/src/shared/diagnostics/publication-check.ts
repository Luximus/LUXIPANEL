/** Public contributions must contain source, never captured credentials. */
export function assertPublishableSource(text: string): void {
  const patterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
    /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}|lxp_live_[A-Za-z0-9_-]{16,}|AKIA[A-Z0-9]{16})\b/,
    /(?:password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*["'][A-Za-z0-9+/_=-]{24,}["']/i,
  ];
  // A quoted, standalone PEM header is a form hint, not key material.
  // Serialized or multiline keys retain their header and remain rejected.
  const source=text.replace(/(["'])-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----\1/g,"[private-key format hint]");
  // Only a complete variable/property interpolation is a reference to a runtime
  // password. Literal values, mixed passwords and expressions remain rejected.
  const credentialUrls = source.matchAll(/[a-z][a-z0-9+.-]*:\/\/[^\s/:]+:([^\s/@]{8,})@/gi);
  const variableReference = /^\$\{[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\}$/;
  const embeddedPassword = [...credentialUrls].some((match) => !variableReference.test(match[1]!));
  if (embeddedPassword || patterns.some((pattern) => pattern.test(source))) throw new Error("El aporte contiene una posible credencial. Elimina el secreto antes de publicar.");
}
