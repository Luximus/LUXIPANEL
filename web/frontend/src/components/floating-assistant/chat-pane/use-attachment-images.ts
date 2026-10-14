import { useEffect, useRef, useState } from "react";
import { resolvePanelApiPath, scopeHeaders } from "@/lib/api-client";
import type { TurnAttachment } from "../chat-engine";

/** Image requests need the active tab's bridge header; an <img src> cannot send it. */
export function useAttachmentImages(attachments: TurnAttachment[]): ReadonlyMap<string, string> {
  const [resolved, setResolved] = useState<Map<string, string>>(() => new Map());
  const cache = useRef(new Map<string, string>());
  const pending = useRef(new Set<string>());
  const mounted = useRef(true);
  const imageUrls = attachments
    .filter((item) => item.mimeType.startsWith("image/") && item.url.startsWith("/api/"))
    .map((item) => item.url);
  const imageKey = [...new Set(imageUrls)].join("\n");

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const url of cache.current.values()) URL.revokeObjectURL(url);
      cache.current.clear();
    };
  }, []);

  useEffect(() => {
    for (const url of imageKey ? imageKey.split("\n") : []) {
      if (cache.current.has(url) || pending.current.has(url)) continue;
      pending.current.add(url);
      void fetch(resolvePanelApiPath(url), {
        credentials: "include",
        headers: scopeHeaders(),
      }).then((response) => {
        if (!response.ok) throw new Error(`Image ${response.status}`);
        return response.blob();
      }).then((blob) => {
        if (!mounted.current) return;
        const objectUrl = URL.createObjectURL(blob);
        cache.current.set(url, objectUrl);
        setResolved(new Map(cache.current));
      }).catch(() => undefined).finally(() => pending.current.delete(url));
    }
  }, [imageKey]);

  return resolved;
}
