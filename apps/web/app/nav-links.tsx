"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ui from "./ui.module.css";

const LINKS = [
  {
    href: "/inbox",
    label: "Inbox",
    match: ["/inbox", "/spend"],
    icon: "M4 13h4l1.5 2.5h5L16 13h4M4 13l2.5-7h11l2.5 7v6H4z",
  },
  {
    href: "/receive",
    label: "Get paid",
    match: ["/receive"],
    icon: "M12 4v10m-4-4 4 4 4-4M5 19h14",
  },
] as const;

/** The recipient routes, with the current page marked: a top nav on wide screens, a bottom tab bar on phones. */
export function NavLinks() {
  const path = usePathname() ?? "";
  const isCurrent = (match: readonly string[]) => match.some((prefix) => path.startsWith(prefix));
  return (
    <>
      <nav aria-label="Recipient" className={ui.nav}>
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} aria-current={isCurrent(link.match) ? "page" : undefined}>
            {link.label}
          </Link>
        ))}
      </nav>
      <nav aria-label="Recipient" className={ui.tabs}>
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} aria-current={isCurrent(link.match) ? "page" : undefined}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d={link.icon} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {link.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
