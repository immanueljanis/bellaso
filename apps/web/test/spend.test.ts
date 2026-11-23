import { expect, test } from "bun:test";
import { SEND_UQOR, REGISTRATION_UQOR, sendAmount, spendNeeds } from "../src/spend";

test("sendAmount takes the fee from the QOR and drops a QOR rest of zero", () => {
  const fusd = { denom: "erc20:0xF", amount: "150000000" };
  expect(sendAmount([fusd, { denom: "uqor", amount: "150000" }], 34_133n)).toEqual([fusd, { denom: "uqor", amount: "115867" }]);
  expect(sendAmount([fusd, { denom: "uqor", amount: "34133" }], 34_133n)).toEqual([fusd]);
  expect(sendAmount([{ denom: "uqor", amount: "100" }], 34_133n)).toEqual([]);
});

test("spendNeeds counts transaction 1 only before the first spend", () => {
  expect(spendNeeds(false)).toBe(REGISTRATION_UQOR + SEND_UQOR);
  expect(spendNeeds(true)).toBe(SEND_UQOR);
  expect(spendNeeds(false)).toBeLessThanOrEqual(150_000n);
});
