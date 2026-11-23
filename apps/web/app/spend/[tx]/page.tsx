import type { Metadata } from "next";
import { SpendClient } from "./spend-client";

export const metadata: Metadata = { title: "Spend a payment" };

export default async function SpendPage({ params }: { params: Promise<{ tx: string }> }) {
  const { tx } = await params;
  return <SpendClient txHash={decodeURIComponent(tx)} />;
}
