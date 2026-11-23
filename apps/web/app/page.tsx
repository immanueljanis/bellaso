import { TESTNET } from "@bellaso/chain";
import Link from "next/link";

const routes = [
  { href: "/create", label: "Create my Bellaso" },
  { href: "/pay/demo", label: "Pay a link" },
  { href: "/receive", label: "Get paid" },
  { href: "/inbox", label: "Inbox" },
];

export default function Home() {
  return (
    <main className="page">
      <h1>Bellaso</h1>
      <p className="muted">Private payment links that stay private after Q-Day.</p>
      <nav aria-label="Routes">
        <ul>
          {routes.map((route) => (
            <li key={route.href}>
              <Link href={route.href}>{route.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <p className="mono muted">Testnet · {TESTNET.chainId}</p>
    </main>
  );
}
