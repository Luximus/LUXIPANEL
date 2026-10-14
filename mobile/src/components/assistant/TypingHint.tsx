// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React, { useEffect, useRef, useState } from "react";
import { Text } from "react-native";

/**
 * Texto del estado vacío con efecto typewriter: tipea cada frase de ejemplo, la
 * mantiene, la borra y pasa a la siguiente en bucle (réplica RN del efecto del
 * hero del home web).
 */
export function TypingHint({ phrases, style }: { phrases: string[]; style?: any }) {
  const [text, setText] = useState("");
  const [blink, setBlink] = useState(true);
  const idxRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => setBlink((b) => !b), 530);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!phrases.length) return;
    const cur = () => phrases[idxRef.current % phrases.length];
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
    <Text style={style}>
      {text}
      <Text style={{ color: "#a78bfa", opacity: blink ? 1 : 0 }}>▏</Text>
    </Text>
  );
}
