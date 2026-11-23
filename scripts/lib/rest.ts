import { TESTNET } from "@bellaso/chain";

export interface Coin {
  denom: string;
  amount: string;
}

/** Reads a JSON document from the testnet REST endpoint. The CLI reads the chain directly, not through the gateway. */
export async function rest<T>(path: string): Promise<T> {
  const response = await fetch(`${TESTNET.rest}${path}`);
  if (!response.ok) throw new Error(`GET ${path} answered ${response.status}`);
  return (await response.json()) as T;
}

/** All bank balances of an address. */
export async function balances(address: string): Promise<Coin[]> {
  return (await rest<{ balances: Coin[] }>(`/cosmos/bank/v1beta1/balances/${address}`)).balances;
}

/** The uqor balance of an address. */
export async function balanceUqor(address: string): Promise<bigint> {
  const body = await rest<{ balance?: Coin }>(
    `/cosmos/bank/v1beta1/balances/${address}/by_denom?denom=${TESTNET.denoms.QOR.denom}`,
  );
  return BigInt(body.balance?.amount ?? "0");
}
