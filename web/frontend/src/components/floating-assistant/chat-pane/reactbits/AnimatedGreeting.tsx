import { useEffect, useState } from "react";
import "./chat-reveal.css";

/** Text Type + Gradient Text greeting, following Luxisoft's project greeting. */
export function AnimatedGreeting({ text, highlightedName }: { text: string; highlightedName?: string | null }) {
  return <TypedGreeting key={`${highlightedName ?? ""}:${text}`} text={text} highlightedName={highlightedName} />;
}

function TypedGreeting({ text, highlightedName }: { text: string; highlightedName?: string | null }) {
  const [visible, setVisible] = useState(0);
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const length = Array.from(text).length;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (reduced || visible >= length) return;
    const timer = window.setTimeout(() => setVisible(value => value + 1), visible === 0 ? 180 : 28);
    return () => window.clearTimeout(timer);
  }, [visible, length, reduced]);

  const name = highlightedName?.trim();
  const parts = name && text.includes(name) ? text.split(name) : [text];
  let offset = 0;
  const reveal = (value: string) => Array.from(value).map(character => {
    const index = offset++;
    const current = reduced ? length : visible;
    return <span key={index} className={index >= current ? "lxp-greeting-pending" : index === current - 1 && current < length ? "lxp-greeting-caret" : undefined}>{character}</span>;
  });

  return <span className="lxp-animated-greeting">
    <span className="sr-only">{text}</span>
    <span aria-hidden="true">{parts.map((part, index) => <span key={index}>
      {index > 0 && name ? <span className="lxp-greeting-gradient">{reveal(name)}</span> : null}{reveal(part)}
    </span>)}</span>
  </span>;
}
