import { TESTNET } from "@bellaso/chain";
import Link from "next/link";
import type { ReactNode } from "react";
import { NavLinks } from "./nav-links";
import ui from "./ui.module.css";

/** The header of every page: the wordmark, the recipient routes when `nav` is set, the network, and an optional action. */
export function SiteHeader({ nav = false, action }: { nav?: boolean; action?: ReactNode }) {
  return (
    <header className={ui.header}>
      <div className={ui.headerInner}>
        <Link href="/" className={ui.wordmark}>
          <img src="/brand/bellaso-mark-small.svg" alt="" width={30} height={30} className={ui.markImage} />
          Bellaso
        </Link>
        {nav && <NavLinks />}
        <span className={ui.spacer} />
        <span className={ui.pill}>
          <span className={ui.dot} aria-hidden="true" />
          Testnet<span className={ui.pillChain}> · {TESTNET.chainId}</span>
        </span>
        {action}
      </div>
    </header>
  );
}
