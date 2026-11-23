import type { Metadata } from "next";
import { TxClient } from "./tx-client";

export const metadata: Metadata = { title: "Transaction" };

export default async function TxPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  return <TxClient hash={hash} />;
}
