import { expect, test } from "bun:test";
import { buildApp } from "../src/app";
import { readConfig } from "../src/config";

test("health answers, with CORS only for an allowed origin", async () => {
  const app = await buildApp({ port: 0, allowedOrigins: ["http://localhost:3000"] });

  const allowed = await app.inject({ method: "GET", url: "/v1/health", headers: { origin: "http://localhost:3000" } });
  expect(allowed.statusCode).toBe(200);
  expect(allowed.json()).toEqual({ ok: true });
  expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");

  const other = await app.inject({ method: "GET", url: "/v1/health", headers: { origin: "https://other.example" } });
  expect(other.headers["access-control-allow-origin"]).toBeUndefined();

  await app.close();
});

test("readConfig refuses a bad port and splits the origins", () => {
  expect(() => readConfig({ PORT: "abc" })).toThrow("PORT must be an integer");
  expect(readConfig({ ALLOWED_ORIGINS: "https://a.example, https://b.example" }).allowedOrigins).toEqual([
    "https://a.example",
    "https://b.example",
  ]);
});
