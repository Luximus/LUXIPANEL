// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** React Bits Animated List adapted for keyed React rows and progressive loading.
 * Source inspiration: https://reactbits.dev/components/animated-list
 * The parent owns the scroll height; this component never imposes a max-height.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

const BATCH = 12;

export function AnimatedList<T>({
  items,
  itemKey,
  renderItem,
  resetKey,
  ensureVisibleIndex = -1,
  className = "",
}: {
  items: T[];
  itemKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  resetKey: string;
  ensureVisibleIndex?: number;
  className?: string;
}) {
  const [visibleCount, setVisibleCount] = useState(BATCH);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => { setVisibleCount(BATCH); }, [resetKey]);
  useEffect(() => {
    if (ensureVisibleIndex >= 0) setVisibleCount((count) => Math.max(count, ensureVisibleIndex + 1));
  }, [ensureVisibleIndex]);
  useEffect(() => {
    if (visibleCount >= items.length || !sentinelRef.current) return;
    if (typeof IntersectionObserver === "undefined") { setVisibleCount(items.length); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setVisibleCount((count) => Math.min(items.length, count + BATCH));
    }, { rootMargin: "240px 0px" });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [items.length, visibleCount]);

  return (
    <div className={className} data-animated-list>
      {items.slice(0, visibleCount).map((item, index) => (
        <motion.div
          key={itemKey(item)}
          initial={reduceMotion ? false : { opacity: 0, y: 7 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.2, delay: Math.min(index, 4) * 0.025, ease: "easeOut" }}
        >
          {renderItem(item, index)}
        </motion.div>
      ))}
      {visibleCount < items.length && <div ref={sentinelRef} aria-hidden="true" className="h-1" />}
    </div>
  );
}
