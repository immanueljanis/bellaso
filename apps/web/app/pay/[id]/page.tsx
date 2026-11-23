import type { Metadata } from "next";
import { PayClient } from "./pay-client";

export const metadata: Metadata = { title: "Pay · Bellaso" };

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PayClient recipient={decodeURIComponent(id)} />;
}
