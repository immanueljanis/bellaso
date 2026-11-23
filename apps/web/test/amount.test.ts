import { expect, test } from "bun:test";
import { toBaseUnits } from "../src/amount";

test("toBaseUnits converts decimal text and refuses bad input", () => {
  expect(toBaseUnits("150", 6)).toBe(150_000_000n);
  expect(toBaseUnits("150.5", 6)).toBe(150_500_000n);
  expect(toBaseUnits(" 0.000001 ", 6)).toBe(1n);
  expect(toBaseUnits("0", 6)).toBeNull();
  expect(toBaseUnits("1.0000001", 6)).toBeNull();
  expect(toBaseUnits("-1", 6)).toBeNull();
  expect(toBaseUnits("1e3", 6)).toBeNull();
  expect(toBaseUnits("", 6)).toBeNull();
});
