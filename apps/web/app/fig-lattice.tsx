"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./landing.module.css";

const COLUMNS = 9;
const ROWS = 8;
const LAYERS = 5;
const SKEW = 0.34;
const CAMERA = 24;
/** One loop in seconds: the sweep of your key, a hold, the sweep of a quantum computer, a hold. */
const SWEEP = 5;
const HALF = 7;
const CYCLE = HALF * 2;

const MINE = [
  { column: 2, row: 1, layer: 1, label: "150 fUSD" },
  { column: 7, row: 4, layer: 3, label: "0.25 fETH" },
  { column: 5, row: 6, layer: 0, label: "80 fUSD" },
] as const;

interface Node {
  x: number;
  y: number;
  z: number;
  label?: string;
}

/** The announcements as a skewed 3D lattice, centered on the origin. Three of them are yours. */
function lattice(): Node[] {
  const nodes: Node[] = [];
  for (let layer = 0; layer < LAYERS; layer++) {
    for (let row = 0; row < ROWS; row++) {
      for (let column = 0; column < COLUMNS; column++) {
        nodes.push({
          x: column + row * SKEW - ((COLUMNS - 1) + (ROWS - 1) * SKEW) / 2,
          y: row - (ROWS - 1) / 2,
          z: (layer - (LAYERS - 1) / 2) * 1.5,
          label: MINE.find((mine) => mine.column === column && mine.row === row && mine.layer === layer)?.label,
        });
      }
    }
  }
  return nodes;
}

const EXTENT_X = ((COLUMNS - 1) + (ROWS - 1) * SKEW) / 2 + 0.8;
const EXTENT_Y = (ROWS - 1) / 2 + 0.6;
const EXTENT_Z = ((LAYERS - 1) / 2) * 1.5 + 0.6;
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const ease = (value: number) => 1 - (1 - clamp(value)) ** 3;

/**
 * Fig. 1 of the landing page. A sweep with your key lights three announcements. The same sweep by a quantum
 * computer lights none: that difference is what "quantum-safe" means. Reduced motion gets one still frame.
 */
export function FigLattice() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [observer, setObserver] = useState<"key" | "quantum" | "both">("both");

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const nodes = lattice();
    const css = getComputedStyle(canvas);
    const color = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    const soft = color("--soft", "#cfccc6");
    const accent = color("--accent", "#f0823c");
    const chalk = color("--chalk", "#ecebe4");
    const board = color("--board", "#131110");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let visible = true;
    let shown: "key" | "quantum" | "both" = "both";
    const started = performance.now();

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const render = (seconds: number) => {
      const loop = still ? SWEEP + 0.6 : seconds % CYCLE;
      const quantum = !still && loop >= HALF;
      const local = quantum ? loop - HALF : loop;
      const sweep = local / SWEEP;
      const plane = -EXTENT_X + sweep * EXTENT_X * 2;
      const turn = still ? -0.32 : Math.sin(seconds / 6.5) * 0.36;
      const tilt = 0.2;
      const unit = Math.min(width / 14, height / 10.4);
      const project = (x: number, y: number, z: number) => {
        const rx = x * Math.cos(turn) + z * Math.sin(turn);
        const rz = -x * Math.sin(turn) + z * Math.cos(turn);
        const ry = y * Math.cos(tilt) - rz * Math.sin(tilt);
        const depth = y * Math.sin(tilt) + rz * Math.cos(tilt);
        const scale = (unit * CAMERA) / (CAMERA + depth);
        return { x: width / 2 + rx * scale, y: height * 0.46 + ry * scale, scale: scale / unit, depth };
      };

      context.clearRect(0, 0, width, height);

      if (!still && sweep <= 1) {
        const corners = [
          project(plane, -EXTENT_Y, -EXTENT_Z),
          project(plane, -EXTENT_Y, EXTENT_Z),
          project(plane, EXTENT_Y, EXTENT_Z),
          project(plane, EXTENT_Y, -EXTENT_Z),
        ];
        context.beginPath();
        corners.forEach((corner, index) => (index === 0 ? context.moveTo(corner.x, corner.y) : context.lineTo(corner.x, corner.y)));
        context.closePath();
        context.fillStyle = quantum ? soft : accent;
        context.strokeStyle = quantum ? soft : accent;
        context.globalAlpha = 0.05;
        context.fill();
        context.globalAlpha = 0.5;
        context.lineWidth = 1;
        context.stroke();
      }

      const found: { x: number; y: number; scale: number; label: string; amount: number }[] = [];
      for (const node of nodes) {
        const point = project(node.x, node.y, node.z);
        const near = still ? 0 : clamp(1 - Math.abs(node.x - plane) / 0.7);
        const fog = clamp(0.78 - point.depth / 9);
        const reveal = node.label && !quantum ? ease((plane - node.x) / 0.6) * (still ? 1 : clamp((HALF - 0.2 - local) / 0.7)) : 0;
        if (node.label && reveal > 0) found.push({ ...point, label: node.label, amount: reveal });
        context.globalAlpha = Math.max(fog * (0.5 + near * 0.5) * (1 - reveal), 0);
        context.fillStyle = near > 0.5 && !quantum ? chalk : soft;
        context.beginPath();
        context.arc(point.x, point.y, (2.4 + near * 1.6) * point.scale, 0, Math.PI * 2);
        context.fill();
      }

      context.font = `12px ${css.fontFamily}`;
      context.textBaseline = "middle";
      for (const mine of found) {
        context.globalAlpha = mine.amount;
        context.fillStyle = accent;
        context.beginPath();
        context.arc(mine.x, mine.y, 4 * mine.scale, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = accent;
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(mine.x, mine.y, (8 + 6 * mine.amount) * mine.scale, 0, Math.PI * 2);
        context.stroke();
        const textWidth = context.measureText(mine.label).width;
        const left = mine.x + 32 + textWidth > width ? mine.x - 32 - textWidth : mine.x + 20;
        context.fillStyle = board;
        context.fillRect(left, mine.y - 10, textWidth + 12, 20);
        context.fillStyle = accent;
        context.fillText(mine.label, left + 6, mine.y + 1);
      }
      context.globalAlpha = 1;

      const next = still ? "both" : quantum ? "quantum" : "key";
      if (next !== shown) {
        shown = next;
        setObserver(next);
      }
    };

    const tick = (now: number) => {
      if (visible) render((now - started) / 1000);
      frame = requestAnimationFrame(tick);
    };

    resize();
    const sizes = new ResizeObserver(() => {
      resize();
      if (still) render(0);
    });
    sizes.observe(canvas);
    const views = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    views.observe(canvas);
    if (still) render(0);
    else frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      sizes.disconnect();
      views.disconnect();
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className={styles.lattice}
        role="img"
        aria-label="Figure 1. A lattice of announcements. A sweep with your key lights three of them. The same sweep by a quantum computer lights none."
      />
      <ul className={styles.observers} aria-hidden="true">
        <li data-on={observer !== "quantum"}>
          <span className={styles.observerKey} />
          Your key: finds 3
        </li>
        <li data-on={observer !== "key"}>
          <span className={styles.observerQuantum} />A quantum computer: finds 0
        </li>
      </ul>
    </>
  );
}
