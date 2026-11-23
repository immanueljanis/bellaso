import { expect, test } from "bun:test";
import { LABEL_NAMES, label } from "../src";

test("the label set matches TECH_SPEC section 4.2", () => {
  expect([...LABEL_NAMES]).toEqual([
    "pq-root",
    "view-tag",
    "spend-tweak",
    "pq-seed",
    "addr-tweak",
    "addr-pq-seed",
  ]);
});

test("a label is the UTF-8 bytes of bellaso/v1/<name>", () => {
  expect(Buffer.from(label("view-tag")).toString("hex")).toBe(
    Buffer.from("bellaso/v1/view-tag", "utf8").toString("hex"),
  );
});
