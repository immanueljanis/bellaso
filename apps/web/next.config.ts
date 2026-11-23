import path from "node:path";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const gatewayOrigin = new URL(process.env.NEXT_PUBLIC_GATEWAY_URL ?? "https://gateway-production-4e82893b.up.railway.app").origin;

/**
 * The Content Security Policy (Next.js guide "Without Nonces"). `connect-src` allows only this
 * site and the gateway, so a script that ever ran here could not send the vault or a phrase to
 * another server. `frame-ancestors 'none'` stops clickjacking of the spend and create pages.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${gatewayOrigin}${isDev ? " ws: http://localhost:8080" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

/**
 * Workspace packages export TypeScript source, so Next.js compiles them and they have no
 * build step. The Turbopack root is the repository root, not a parent folder that has its
 * own workspace file. Every page gets the security headers.
 */
const config: NextConfig = {
  transpilePackages: ["@bellaso/core", "@bellaso/chain"],
  turbopack: {
    root: path.join(import.meta.dirname, "../.."),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default config;
