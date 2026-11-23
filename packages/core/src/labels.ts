/**
 * Domain labels of TECH_SPEC section 4.2. Each derivation hashes the UTF-8 string
 * `bellaso/v1/<name>` followed by fixed-length inputs, so no length prefix is needed.
 * A new label needs a test vector that fails on the old behavior.
 */
export const LABEL_NAMES = [
  "pq-root",
  "view-tag",
  "spend-tweak",
  "pq-seed",
  "addr-tweak",
  "addr-pq-seed",
] as const;

export type LabelName = (typeof LABEL_NAMES)[number];

const encoder = new TextEncoder();

/** The UTF-8 bytes of the domain label for `name`. */
export function label(name: LabelName): Uint8Array {
  return encoder.encode(`bellaso/v1/${name}`);
}
