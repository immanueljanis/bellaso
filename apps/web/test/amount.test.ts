import { expect, test } from "bun:test";
import { TESTNET } from "@bellaso/chain";
import { formatCoin, mainCoin, toBaseUnits } from "../src/amount";

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

test("formatCoin shows test denoms in whole units and keeps unknown denoms raw", () => {
  expect(formatCoin({ denom: "uqor", amount: "150000" })).toBe("0.15 QOR");
  expect(formatCoin({ denom: TESTNET.denoms.fUSD.denom, amount: (150n * 10n ** BigInt(TESTNET.denoms.fUSD.decimals)).toString() })).toBe(
    "150 fUSD",
  );
  expect(formatCoin({ denom: "uqor", amount: "1234567000" })).toBe("1,234.567 QOR");
  expect(formatCoin({ denom: "ufoo", amount: "7" })).toBe("7 ufoo");
});

test("mainCoin treats QOR next to a token as the gas allowance", () => {
  const fusd = { denom: TESTNET.denoms.fUSD.denom, amount: "1" };
  const qor = { denom: "uqor", amount: "150000" };
  expect(mainCoin([qor, fusd])).toEqual({ main: fusd, gas: qor });
  expect(mainCoin([qor])).toEqual({ main: qor, gas: undefined });
});
