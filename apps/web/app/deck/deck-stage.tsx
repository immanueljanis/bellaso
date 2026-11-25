"use client";

import { Children, type ReactNode, useEffect, useState } from "react";
import styles from "./deck.module.css";

/**
 * The stage of the deck: one slide in view, its label at the top left, the count at the top right, and the dots with the previous
 * and next actions below. The arrow keys do the same. Each slide stays in the document, so print shows all of them.
 */
export function DeckStage({ labels, children }: { labels: readonly string[]; children: ReactNode }) {
  const slides = Children.toArray(children);
  const last = slides.length - 1;
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const step = event.key === "ArrowRight" || event.key === "PageDown" ? 1 : event.key === "ArrowLeft" || event.key === "PageUp" ? -1 : 0;
      if (step === 0) return;
      event.preventDefault();
      setCurrent((index) => Math.min(last, Math.max(0, index + step)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last]);

  return (
    <main className={styles.stage}>
      <div className={styles.top}>
        <p className={styles.kicker} aria-live="polite">
          {labels[current]}
        </p>
        <p className={styles.count}>
          {current + 1} / {slides.length}
        </p>
      </div>
      {slides.map((slide, index) => (
        <section key={labels[index]} className={styles.slide} aria-label={labels[index]} hidden={index !== current}>
          {slide}
        </section>
      ))}
      <nav className={styles.bar} aria-label="Slides">
        <button type="button" className={styles.step} onClick={() => setCurrent(current - 1)} disabled={current === 0} aria-label="Previous slide">
          ←
        </button>
        <span className={styles.dots}>
          {labels.map((label, index) => (
            <button
              key={label}
              type="button"
              className={styles.dot}
              aria-label={`Go to slide ${index + 1}: ${label}`}
              aria-current={index === current ? "step" : undefined}
              onClick={() => setCurrent(index)}
            />
          ))}
        </span>
        <button type="button" className={styles.step} onClick={() => setCurrent(current + 1)} disabled={current === last} aria-label="Next slide">
          →
        </button>
      </nav>
    </main>
  );
}
