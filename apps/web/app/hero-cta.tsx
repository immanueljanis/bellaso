"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hasVault } from "@/src/vault";
import styles from "./landing.module.css";

/** The main action of the landing page: the setup for a new browser, the inbox for a browser that already holds a vault. */
export function HeroCta() {
  const [returning, setReturning] = useState(false);
  useEffect(() => setReturning(hasVault()), []);
  return (
    <Link href={returning ? "/inbox" : "/create"} className={styles.cta}>
      {returning ? "Open my inbox" : "Create my Bellaso"} <span className={styles.arrow}>→</span>
    </Link>
  );
}
