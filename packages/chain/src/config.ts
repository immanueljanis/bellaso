/**
 * QoreChain testnet constants (TECH_SPEC section 3), read or measured on 23 Nov 2026.
 * Denoms are case-sensitive.
 */
export const TESTNET = {
  chainId: "qorechain-diana",
  rest: "https://api-testnet.qore.host",
  rpc: "https://rpc-testnet.qore.host",
  bech32Prefix: "qor",
  minGasPriceUqor: 0.1,
  announcementCodeId: 865,
  denoms: {
    QOR: { denom: "uqor", decimals: 6 },
    fUSD: { denom: "erc20:0x97143B771D34ddb9130b807b135Ae675A5a963CA", decimals: 6 },
    fETH: { denom: "erc20:0x02292293c13880a26242690eb70a0e42B8E91c28", decimals: 18 },
    fBTC: { denom: "erc20:0x4604e7E45b2ecdbfbDc157103f5B2b62cb16451A", decimals: 8 },
  },
} as const;

export type Network = typeof TESTNET;
