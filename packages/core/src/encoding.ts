import { decode, encode } from "base32768";

/** The announcement contract accepts 1 to 140 characters for each note (TECH_SPEC section 5.2). */
export const RECORD_MAX_LENGTH = 140;
const MAX_RECORDS = 9;
const HEADER = /^BL1:([1-9]):/;

/**
 * Splits bytes into contract records: base32768 text, the first record prefixed with
 * `BL1:<n>:`. base32768 has no whitespace, so the trim of the contract does not change it.
 */
export function toRecords(bytes: Uint8Array): string[] {
  const body = encode(bytes);
  const header = (n: number) => `BL1:${n}:`;
  const firstRoom = RECORD_MAX_LENGTH - header(1).length;
  const count = 1 + Math.ceil(Math.max(0, body.length - firstRoom) / RECORD_MAX_LENGTH);
  if (count > MAX_RECORDS) throw new RangeError(`Needs ${count} records, the maximum is ${MAX_RECORDS}`);
  const records = [header(count) + body.slice(0, firstRoom)];
  for (let at = firstRoom; at < body.length; at += RECORD_MAX_LENGTH) {
    records.push(body.slice(at, at + RECORD_MAX_LENGTH));
  }
  return records;
}

/** Joins the records of one transaction, in message order. Throws on a bad header or count. */
export function fromRecords(notes: readonly string[]): Uint8Array {
  const match = HEADER.exec(notes[0] ?? "");
  if (!match) throw new SyntaxError("First record has no BL1 header");
  const count = Number(match[1]);
  if (notes.length !== count) throw new RangeError(`Header says ${count} records, got ${notes.length}`);
  return decode(notes[0]!.slice(match[0].length) + notes.slice(1).join(""));
}
