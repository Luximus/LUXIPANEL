import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMessage } from "../i18n";

/**
 * Carrusel genérico con el MISMO look/comportamiento que `ServerWindowCarousel`
 * (scroll-snap horizontal, flechas prev/next con navegación CÍCLICA — del último
 * vuelve al primero —, indicador con puntos y posición), pero de alto AUTOMÁTICO
 * para usarse dentro de modales. Cada `slide` es un ReactNode (p. ej. un grupo
 * de tarjetas de producto). Reutiliza las clases `server-carousel*` + la variante
 * `server-carousel--auto`.
 */
export function CardCarousel({
  slides,
  labels,
}: {
  slides: ReactNode[];
  /** `position` admite `{current}`/`{total}` (formato m:ss no, es "X de N"). */
  labels: { prev: string; next: string; position: string };
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const total = slides.length;
  const safeIndex = Math.min(activeIndex, Math.max(0, total - 1));

  // Slide visible por intersección con el track (root del scroll).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let best: { index: number; ratio: number } | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.index ?? "-1");
          if (index < 0) continue;
          if (!best || entry.intersectionRatio > best.ratio) best = { index, ratio: entry.intersectionRatio };
        }
        if (best) setActiveIndex(best.index);
      },
      { root: track, threshold: [0.5, 0.75, 1] },
    );
    for (const slide of slideRefs.current) if (slide) observer.observe(slide);
    return () => observer.disconnect();
  }, [total]);

  const goTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(total - 1, index));
    slideRefs.current[clamped]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setActiveIndex(clamped);
  }, [total]);

  // Navegación CÍCLICA (ciclo infinito): avanzar desde el último vuelve al primero.
  const goRelative = useCallback((delta: number) => {
    if (total <= 0) return;
    goTo((((safeIndex + delta) % total) + total) % total);
  }, [goTo, safeIndex, total]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const isRtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";
    const forward = isRtl ? event.key === "ArrowLeft" : event.key === "ArrowRight";
    event.preventDefault();
    goRelative(forward ? 1 : -1);
  }, [goRelative]);

  if (total === 0) return null;

  return (
    <div
      className="server-carousel server-carousel--auto"
      tabIndex={0}
      role="group"
      aria-roledescription="carousel"
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className="server-carousel__nav server-carousel__nav--prev lp-icon-btn tooltip tooltip-bottom"
        onClick={() => goRelative(-1)}
        disabled={total <= 1}
        aria-label={labels.prev}
        data-tip={labels.prev}
      >
        <ChevronLeft size={18} className="lp-rtl-flip" />
      </button>

      <div ref={trackRef} className="server-carousel__track">
        {slides.map((slide, index) => (
          <div
            key={index}
            ref={(node) => { slideRefs.current[index] = node; }}
            data-index={index}
            className="server-carousel__slide"
          >
            {slide}
          </div>
        ))}
      </div>

      <button
        type="button"
        className="server-carousel__nav server-carousel__nav--next lp-icon-btn tooltip tooltip-bottom"
        onClick={() => goRelative(1)}
        disabled={total <= 1}
        aria-label={labels.next}
        data-tip={labels.next}
      >
        <ChevronRight size={18} className="lp-rtl-flip" />
      </button>

      <div className="server-carousel__indicator">
        <span className="server-carousel__count">
          {formatMessage(labels.position, { current: safeIndex + 1, total })}
        </span>
        <div className="server-carousel__dots">
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              className={`server-carousel__dot ${index === safeIndex ? "is-active" : ""}`}
              onClick={() => goTo(index)}
              aria-label={`${index + 1}`}
              aria-current={index === safeIndex}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
