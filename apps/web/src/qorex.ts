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

/** Asks QoreX to connect to `chainId` and returns the payer address. */
export async function connectQorex(chainId: string): Promise<string> {
  const native = qorexNative();
  if (!native) throw new Error("QoreX is not installed in this browser.");
  await native.enable(chainId);
  return (await native.getKey(chainId)).bech32Address;
}
