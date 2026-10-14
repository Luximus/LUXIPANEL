import { useEffect, useState } from "react";

/** Keep the compact CLI row in the mobile header across Astro navigation. */
export function useChatCliTarget() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 1024px)");
    const sync = () => setTarget(mobile.matches && !document.documentElement.classList.contains("lxp-webview")
      ? document.getElementById("workspace-chat-cli") : null);
    sync();
    mobile.addEventListener("change", sync);
    document.addEventListener("astro:after-swap", sync);
    document.addEventListener("astro:page-load", sync);
    return () => {
      mobile.removeEventListener("change", sync);
      document.removeEventListener("astro:after-swap", sync);
      document.removeEventListener("astro:page-load", sync);
    };
  }, []);
  return target;
}
