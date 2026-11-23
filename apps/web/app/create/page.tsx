import type { Metadata } from "next";
import { CreateClient } from "./create-client";

export const metadata: Metadata = { title: "Create your Bellaso" };

export default function CreatePage() {
  return <CreateClient />;
}
