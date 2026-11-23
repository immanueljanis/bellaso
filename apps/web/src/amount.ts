/** Converts a decimal text such as "150.5" to integer base units. Returns null for anything that is not a positive amount. */
export function toBaseUnits(text: string, decimals: number): bigint | null {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (!match) return null;
  const fraction = match[2] ?? "";
  if (fraction.length > decimals) return null;
  const units = BigInt(match[1]! + fraction.padEnd(decimals, "0"));
  return units > 0n ? units : null;
}
