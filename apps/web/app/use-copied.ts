"use client";

import { useEffect, useState } from "react";

/** Copies a text to the clipboard. `copied` names what was copied for two seconds, so a button can confirm it and then offer the copy again. */
export function useCopied() {
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (copied === null) return;
    const timer = setTimeout(() => setCopied(null), 2_000);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async (text: string, what = "text") => {
    await navigator.clipboard.writeText(text);
    setCopied(what);
  };
  return { copied, copy };
}
