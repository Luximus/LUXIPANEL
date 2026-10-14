import { useEffect, useRef, useState } from "react";

/**
 * Texto del estado vacío con efecto typewriter: tipea cada frase de ejemplo, la
 * mantiene, la borra y pasa a la siguiente en bucle (mismo espíritu que el hero
 * del home web). Respeta `prefers-reduced-motion`: solo rota el texto completo.
 */
export function TypingHint({ phrases, className }: { phrases: string[]; className?: string }) {
  const [text, setText] = useState("");
  const idxRef = useRef(0);

  useEffect(() => {
    if (!phrases.length) return;
    const reduce =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const cur = () => phrases[idxRef.current % phrases.length];

    if (reduce) {
      setText(cur());
      const id = setInterval(() => {
        idxRef.current += 1;
        setText(cur());
      }, 3000);
      return () => clearInterval(id);
    }

    let timer: ReturnType<typeof setTimeout>;
    let phase: "typing" | "hold" | "erasing" = "typing";
    let j = 0;
    const step = () => {
      const phrase = cur();
      if (phase === "typing") {
        j += 1;
        setText(phrase.slice(0, j));
        if (j >= phrase.length) { phase = "hold"; timer = setTimeout(step, 1100); }
        else timer = setTimeout(step, 45);
      } else if (phase === "hold") {
        phase = "erasing";
        timer = setTimeout(step, 25);
      } else {
        j -= 1;
        setText(phrase.slice(0, j));
        if (j <= 0) { phase = "typing"; idxRef.current += 1; timer = setTimeout(step, 240); }
        else timer = setTimeout(step, 22);
      }
    };
    timer = setTimeout(step, 400);
    return () => clearTimeout(timer);
  }, [phrases]);

  return (
    <p className={className}>
      {text}
      <span className="server-assistant__type-cursor" aria-hidden />
    </p>
  );
}
