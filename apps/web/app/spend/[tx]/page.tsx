import type { Metadata } from "next";
import { SpendClient } from "./spend-client";

export const metadata: Metadata = { title: "Spend a payment" };

/** The route parameter decoded once, or as it is when it is not valid percent-encoding. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function SpendPage({ params }: { params: Promise<{ tx: string }> }) {
  const { tx } = await params;
  return <SpendClient txHash={safeDecode(tx)} />;
}
