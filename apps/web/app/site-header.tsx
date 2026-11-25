import { TESTNET } from "@bellaso/chain";
import Link from "next/link";
import type { ReactNode } from "react";
import { NavLinks } from "./nav-links";
import ui from "./ui.module.css";

/** The header of every page, a capsule that stays at the top: the wordmark, the network, the recipient routes when `nav` is set, and an optional action. */
export function SiteHeader({ nav = false, action }: { nav?: boolean; action?: ReactNode }) {
  return (
    <header className={ui.header}>
      <div className={ui.headerInner}>
        <Link href="/" className={ui.wordmark}>
          <img src="/brand/bellaso-mark-small.svg" alt="" width={30} height={30} className={ui.markImage} />
          Bellaso
        </Link>
        <span className={ui.pill} title={TESTNET.chainId}>
          <span className={ui.dot} aria-hidden="true" />
          Testnet
        </span>
        {nav && <NavLinks />}
        <span className={ui.spacer} />
        {action}
      </div>
    </header>
  );
}
