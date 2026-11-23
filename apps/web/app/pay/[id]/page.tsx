import type { Metadata } from "next";
import { PayClient } from "./pay-client";

export const metadata: Metadata = { title: "Pay" };

/** The route parameter decoded once, or as it is when it is not valid percent-encoding. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PayClient recipient={safeDecode(id)} />;
}
