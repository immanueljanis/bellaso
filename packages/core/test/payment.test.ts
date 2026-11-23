import { describe, expect, test } from "bun:test";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesToHex, randomBytes } from "@noble/hashes/utils.js";
import { generateSealKeys } from "@qorechain/qoreseal";
import {
  ANNOUNCEMENT_LENGTH,
  RECORD_MAX_LENGTH,
  addressOf,
  addressPqSeed,
  addressTweak,
  decodeAnnouncement,
  encodeAnnouncement,
  fromRecords,
  makePaymentTarget,
  openAnnouncement,
  paymentPqSeed,
  pqRootFromSeed,
  spendTweak,
  toRecords,
  tweakPublicKey,
  viewTag,
  type RecipientKeys,
  stealthAddress,
} from "../src";

/** A random recipient: account A, its ML-KEM-1024 key pair and a post-quantum root secret. */
function recipient() {
  const privateKey = secp256k1.utils.randomSecretKey();
  const seal = generateSealKeys();
  const keys: RecipientKeys = {
    privateKey,
    publicKey: secp256k1.getPublicKey(privateKey, true),
    kemSecretKey: seal.mlkemSecretKey,
    pqRoot: randomBytes(32),
  };
  return { keys, kemPublicKey: seal.mlkemPublicKey };
}

describe("test vectors (TECH_SPEC sections 4.2 to 4.6)", () => {
  const ss = Uint8Array.from({ length: 32 }, (_, i) => i);
  const pub = secp256k1.getPublicKey(Uint8Array.from({ length: 32 }, (_, i) => i + 1), true);
  const root = pqRootFromSeed(Uint8Array.from({ length: 64 }, (_, i) => 255 - i));

  test("method 1 derivations are fixed", () => {
    expect(addressOf(pub)).toBe("qor1tp7fhly84qm6q4hhzmp0nh5frtdugmysgp5k9t");
    expect(bytesToHex(root)).toBe("83ca4d721a896de0e33ef74a0a8f3168fd661190065e20b92dcc315fd1baee70");
    expect(viewTag(ss)).toBe(229);
    expect(spendTweak(ss).toString(16)).toBe("a827714fe18f66d6c1c0e9a65fef4cdff00342937ed013a71aa3e40747391f39");
    expect(addressOf(tweakPublicKey(pub, spendTweak(ss)))).toBe("qor1hsl05e9ph87376v00xyvd638xmq7qxj33d3vn8");
    expect(bytesToHex(paymentPqSeed(root, ss))).toBe("e60ebf2a46d576e9b5f6aad2d377eb69266e76c53e1e31fc693711382425e74a");
  });

  test("method 2 derivations are fixed", () => {
    expect(addressOf(tweakPublicKey(pub, addressTweak(root, 0)))).toBe("qor1efmuqzzz6vnc4532dtl9ujja7hv034mammk8m6");
    expect(addressOf(tweakPublicKey(pub, addressTweak(root, 7)))).toBe("qor1namj8zq4xnpq4tpzp3uu5wsx5f5lqm2xax4n60");
    expect(stealthAddress(pub, root, 0)).toBe("qor1efmuqzzz6vnc4532dtl9ujja7hv034mammk8m6");
    expect(stealthAddress(pub, root, 7)).toBe("qor1namj8zq4xnpq4tpzp3uu5wsx5f5lqm2xax4n60");
    expect(bytesToHex(addressPqSeed(root, 0))).toBe("bd3b95430fd5cdbf8b34f379e54b60a1930d50adae5b053760233040b4f07a00");
  });
});

describe("method 1 round trip", () => {
  test("the recipient finds every payment and derives the key of its address (100 payments)", () => {
    const { keys, kemPublicKey } = recipient();
    for (let i = 0; i < 100; i++) {
      const target = makePaymentTarget(keys.publicKey, kemPublicKey);
      const opened = openAnnouncement(keys, target, target.address);
      expect(opened?.address).toBe(target.address);
      expect(addressOf(secp256k1.getPublicKey(opened!.privateKey, true))).toBe(target.address);
    }
  });

  test("announcements for another recipient never match (300 announcements)", () => {
    const me = recipient();
    const other = recipient();
    for (let i = 0; i < 300; i++) {
      const target = makePaymentTarget(other.keys.publicKey, other.kemPublicKey);
      expect(openAnnouncement(me.keys, target, target.address)).toBeNull();
    }
  });

  test("a matching ciphertext with a different transfer destination is refused", () => {
    const { keys, kemPublicKey } = recipient();
    const target = makePaymentTarget(keys.publicKey, kemPublicKey);
    const elsewhere = makePaymentTarget(keys.publicKey, kemPublicKey).address;
    expect(openAnnouncement(keys, target, elsewhere)).toBeNull();
  });
});

describe("announcement format and records", () => {
  const { keys, kemPublicKey } = recipient();
  const bytes = encodeAnnouncement(makePaymentTarget(keys.publicKey, kemPublicKey));

  test("format v1 is 1,570 bytes and refuses a wrong version or length", () => {
    expect(bytes.length).toBe(ANNOUNCEMENT_LENGTH);
    expect(() => decodeAnnouncement(bytes.slice(1))).toThrow();
    const wrongVersion = bytes.slice();
    wrongVersion[0] = 2;
    expect(() => decodeAnnouncement(wrongVersion)).toThrow();
  });

  test("an announcement needs 7 records of 140 characters or less, with no edge whitespace", () => {
    const records = toRecords(bytes);
    expect(records.length).toBe(7);
    expect(records[0]!.startsWith("BL1:7:")).toBe(true);
    for (const record of records) {
      expect(record.length).toBeGreaterThan(0);
      expect(record.length).toBeLessThanOrEqual(RECORD_MAX_LENGTH);
      expect(record.trim()).toBe(record);
    }
    expect(Buffer.from(fromRecords(records)).equals(Buffer.from(bytes))).toBe(true);
  });

  test("records with a bad header or a missing record are refused", () => {
    const records = toRecords(bytes);
    expect(() => fromRecords(["XX" + records[0]!.slice(2), ...records.slice(1)])).toThrow();
    expect(() => fromRecords(records.slice(0, 6))).toThrow();
  });
});
