type Payload = Record<string, any>;
export function createConversationOpenReader() {
  const entries = new Map<string, { until: number; task: Promise<Payload | null> }>();
  return {
    clear: () => entries.clear(),
    async read(scope: string, path: string, load: (path: string) => Promise<any>) {
      const match = /^\/api\/ai\/conversations\/([^/?]+)(\/context|\/session|\/messages)?(?:\?(.*))?$/.exec(path);
      if (!match || (match[2] === "/messages" && match[3] !== "limit=50&offset=0")) return load(path);
      const key = scope + ":" + match[1];
      let entry = entries.get(key);
      if (!entry || entry.until <= Date.now()) {
        entry = { until: Infinity, task: Promise.resolve(null) };
        const own = entry;
        own.task = Promise.resolve().then(() => load(`/api/ai/conversations/${match[1]}/messages?limit=50&offset=0&include=meta,session,context`))
          .then(data => { own.until = Date.now() + 250; return data; }, error => { entries.delete(key); throw error; });
        entries.set(key, own);
        if (entries.size > 32) entries.delete(entries.keys().next().value!);
      }
      const data = await entry.task;
      if (entries.get(key) !== entry) return null;
      // El endpoint combinado puede tardar más o no estar disponible en un
      // panel con versión anterior. Abrir el historial debe poder usar la ruta
      // de mensajes normal aunque falle esa optimización.
      if (!data || Array.isArray(data)) return load(path);
      if (match[2] === "/messages") return data;
      if (match[2] === "/context" && "context" in data) return { context: data.context };
      if (match[2] === "/session" && "sessions" in data) {
        const provider = new URLSearchParams(match[3] ?? "").get("provider");
        return { sessionId: provider ? data.sessions?.[provider] ?? null : data.sessionId ?? null };
      }
      if (!match[2] && "conversation" in data) return { conversation: data.conversation };
      return load(path);
    },
  };
}
