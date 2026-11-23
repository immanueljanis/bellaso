/**
 * QoreChain testnet constants (TECH_SPEC section 3), read or measured on 23 Nov 2026.
 * Denoms are case-sensitive. `announcementContract` is the Bellaso instance of code 865,
 * made by gate G3 (tx 5121FCF7F0DEBBA7DD1C4280E2C9E9326F7FD12B75297EBBAFFCAB5876F365C6).
 */
export const TESTNET = {
  chainId: "qorechain-diana",
  rest: "https://api-testnet.qore.host",
  rpc: "https://rpc-testnet.qore.host",
  bech32Prefix: "qor",
  minGasPriceUqor: 0.1,
  announcementCodeId: 865,
  announcementContract: "qor17jq8wze2n9m02c6vtkle6uxr4xccq07e6gxc2np7zq78feuv7tnq2wpp8d",
  denoms: {
    QOR: { denom: "uqor", decimals: 6 },
    fUSD: { denom: "erc20:0x97143B771D34ddb9130b807b135Ae675A5a963CA", decimals: 6 },
    fETH: { denom: "erc20:0x02292293c13880a26242690eb70a0e42B8E91c28", decimals: 18 },
    fBTC: { denom: "erc20:0x4604e7E45b2ecdbfbDc157103f5B2b62cb16451A", decimals: 8 },
  },
} as const;

export type Network = typeof TESTNET;
