import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import "./chat-reveal.css";

/** Reveal when a paragraph enters the chat viewport, without per-frame JS or layout reads. */
export function ChatScrollReveal({ children, scrollContainerRef, enabled = true }: {
  children: ReactNode;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  enabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!enabled || reduced || !ref.current || !scrollContainerRef.current || typeof IntersectionObserver === "undefined") return;
    const root = ref.current;
    const blocks = Array.from(root.querySelectorAll<HTMLElement>("[data-scroll-reveal-block]"));
    const regions = blocks.length ? blocks : [root];
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("lxp-reveal-entered");
        observer.unobserve(entry.target);
      }
    }, { root: scrollContainerRef.current, threshold: 0 });
    for (const block of regions) {
      const words = Array.from(block.querySelectorAll<HTMLElement>("[data-scroll-reveal-word]"))
        .filter(word => !blocks.length || word.closest("[data-scroll-reveal-block]") === block);
      // CSS handles a short word stagger; long messages reveal whole paragraphs.
      if (words.length && words.length <= 200) {
        block.classList.add("lxp-reveal-words");
        words.forEach((word, index) => word.style.setProperty("--reveal-delay", `${Math.min(index * 12, 480)}ms`));
      }
      observer.observe(block);
    }
    return () => {
      observer.disconnect();
      for (const block of regions) block.classList.remove("lxp-reveal-entered", "lxp-reveal-words");
    };
  }, [children, enabled, reduced, scrollContainerRef]);
  return <div ref={ref} className="lxp-chat-scroll-reveal">{children}</div>;
}
