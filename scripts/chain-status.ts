import { TESTNET } from "@bellaso/chain";

interface LatestBlock {
  block: { header: { chain_id: string; height: string; time: string } };
}

/** Prints the chain ID, height and time of the latest testnet block. The CLI reads the chain directly. */
async function main() {
  const response = await fetch(`${TESTNET.rest}/cosmos/base/tendermint/v1beta1/blocks/latest`);
  if (!response.ok) throw new Error(`REST answered ${response.status}`);
  const { header } = ((await response.json()) as LatestBlock).block;
  if (header.chain_id !== TESTNET.chainId) {
    throw new Error(`Expected chain ${TESTNET.chainId}, got ${header.chain_id}`);
  }
  console.log(`${header.chain_id} · height ${header.height} · ${header.time}`);
}

await main();
