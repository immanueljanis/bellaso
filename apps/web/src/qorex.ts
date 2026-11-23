/** One message for QoreX: type URL and protobuf bytes. */
export interface QorexEncodedMessage {
  readonly typeUrl: string;
  readonly value: Uint8Array | number[] | string;
}

export interface QorexSignAndBroadcastResult {
  readonly txHash: string;
  readonly code: number;
  readonly height?: number;
  /** `shielded` when the committed transaction carries the ML-DSA-87 layer. */
  readonly shield: string;
}

interface QorexNativeProvider {
  readonly capabilities?: readonly string[];
  enable(chainId: string): Promise<void>;
  getKey(chainId: string): Promise<{ bech32Address: string }>;
  signAndBroadcast(request: {
    chainId: string;
    messages: readonly QorexEncodedMessage[];
    memo?: string;
    gasLimit?: number;
  }): Promise<QorexSignAndBroadcastResult>;
}

declare global {
  interface Window {
    qorex?: { native?: QorexNativeProvider };
  }
}

/** The QoreX native provider, or null when the extension is not installed or cannot sign and broadcast. */
export function qorexNative(): QorexNativeProvider | null {
  const native = typeof window === "undefined" ? undefined : window.qorex?.native;
  if (!native) return null;
  if (native.capabilities && !native.capabilities.includes("signAndBroadcast")) return null;
  return native;
}

/**
 * A message a person can act on for a QoreX error. QoreX refuses a request for another
 * network than the active one, and only the user can switch it (mobile: Settings › Use
 * testnet (developers); the extension has no testnet switch).
 */
export function explainQorexError(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String(reason);
  if (/does not match the active network|unsupported chain/i.test(message)) {
    return "QoreX is on mainnet. Bellaso runs on testnet: in the QoreX app, open Settings › Use testnet (developers), then try again.";
  }
  if (/reject|denied|cancel/i.test(message)) return "You cancelled the request in QoreX. Nothing was sent.";
  return message;
}

/** Asks QoreX to connect to `chainId` and returns the payer address. */
export async function connectQorex(chainId: string): Promise<string> {
  const native = qorexNative();
  if (!native) throw new Error("QoreX is not installed in this browser.");
  await native.enable(chainId);
  return (await native.getKey(chainId)).bech32Address;
}
