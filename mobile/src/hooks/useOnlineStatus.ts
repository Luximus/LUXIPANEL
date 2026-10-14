import { useCallback, useEffect, useState } from "react";

const PING_URL = "https://www.gstatic.com/generate_204";
const PING_TIMEOUT_MS = 5000;
const PING_INTERVAL_MS = 4000;

async function probeNetwork(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    await fetch(PING_URL, { method: "HEAD", cache: "no-store", signal: controller.signal });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

export function useOnlineStatus() {
  const [online, setOnline] = useState<boolean>(true);
  const [checking, setChecking] = useState<boolean>(false);

  const recheck = useCallback(async () => {
    setChecking(true);
    const ok = await probeNetwork();
    setOnline(ok);
    setChecking(false);
    return ok;
  }, []);

  useEffect(() => {
    void recheck();
  }, [recheck]);

  useEffect(() => {
    if (online) return;
    let cancelled = false;
    const id = setInterval(async () => {
      const ok = await probeNetwork();
      if (!cancelled && ok) setOnline(true);
    }, PING_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [online]);

  return { online, checking, recheck };
}
