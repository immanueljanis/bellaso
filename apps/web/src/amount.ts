import { type Coin, TESTNET } from "@bellaso/chain";

/** Converts a decimal text such as "150.5" to integer base units. Returns null for anything that is not a positive amount. */
export function toBaseUnits(text: string, decimals: number): bigint | null {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (!match) return null;
  const fraction = match[2] ?? "";
  if (fraction.length > decimals) return null;
  const units = BigInt(match[1]! + fraction.padEnd(decimals, "0"));
  return units > 0n ? units : null;
}

/** The test tokens that a payment link accepts, in the order of the token menu. */
export const PAYMENT_TOKENS = (["fUSD", "fETH", "fBTC"] as const).map((symbol) => ({ symbol, ...TESTNET.denoms[symbol] }));

const TOKENS = new Map<string, { symbol: string; decimals: number }>(Object.entries(TESTNET.denoms).map(([symbol, token]) => [token.denom, { symbol, decimals: token.decimals }]));

/** "150.25 fUSD" for one coin of a known test denom, with the trailing zeros cut. Other denoms show the base units. */
export function formatCoin({ denom, amount }: Coin): string {
  const token = TOKENS.get(denom);
  if (!token) return `${amount} ${denom}`;
  const scale = 10n ** BigInt(token.decimals);
  const units = BigInt(amount);
  const fraction = (units % scale).toString().padStart(token.decimals, "0").replace(/0+$/, "");
  return `${(units / scale).toLocaleString("en-US")}${fraction ? `.${fraction}` : ""} ${token.symbol}`;
}

/** The main coin of a payment: the first coin that is not QOR, else QOR. The QOR next to a token is the gas allowance. */
export function mainCoin(coins: Coin[]): { main: Coin | undefined; gas: Coin | undefined } {
  const token = coins.find((coin) => coin.denom !== TESTNET.denoms.QOR.denom);
  const qor = coins.find((coin) => coin.denom === TESTNET.denoms.QOR.denom);
  return token ? { main: token, gas: qor } : { main: qor, gas: undefined };
}
