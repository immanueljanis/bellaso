"use client";

import { useMemo } from "react";
import { encode } from "uqr";

/** A QR code of `text` as SVG squares in the board colors. */
export function QrCode({ text, label, className }: { text: string; label: string; className?: string }) {
  const { data, size } = useMemo(() => encode(text, { border: 2 }), [text]);
  const cells = data.flatMap((row, y) => row.flatMap((dark, x) => (dark ? [`M${x} ${y}h1v1h-1z`] : []))).join("");
  return (
    <svg className={className} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="var(--chalk)" />
      <path d={cells} fill="var(--board)" />
    </svg>
  );
}
