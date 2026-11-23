import { expect, test } from "bun:test";
import { explainQorexError } from "../src/qorex";

test("a QoreX network mismatch tells the user how to switch to testnet", () => {
  const text = explainQorexError(new Error("QoreX: chain qorechain-diana does not match the active network qorechain-vladi"));
  expect(text).toContain("Use testnet (developers)");
});

test("a cancelled request says nothing was sent, and other errors pass through", () => {
  expect(explainQorexError(new Error("Request rejected by user"))).toContain("Nothing was sent");
  expect(explainQorexError("Insufficient funds")).toBe("Insufficient funds");
});
