import type { Metadata } from "next";
import { ReceiveClient } from "./receive-client";

export const metadata: Metadata = { title: "Get paid" };

export default function ReceivePage() {
  return <ReceiveClient />;
}
