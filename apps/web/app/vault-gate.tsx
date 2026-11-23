"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { type VaultData, hasVault, lockVault, openVault, unlockVault } from "@/src/vault";
import ui from "./ui.module.css";

type VaultState = { kind: "loading" } | { kind: "none" } | { kind: "locked" } | { kind: "open"; vault: VaultData };

/** The vault state of this tab. A page reload locks the vault again (`src/vault.ts`). */
export function useVault() {
  const [state, setState] = useState<VaultState>({ kind: "loading" });
  useEffect(() => {
    const open = openVault();
    setState(open ? { kind: "open", vault: open } : hasVault() ? { kind: "locked" } : { kind: "none" });
  }, []);
  return {
    state,
    opened: (vault: VaultData) => setState({ kind: "open", vault }),
    lock: () => {
      lockVault();
      setState({ kind: "locked" });
    },
  };
}

/** The passphrase form of a locked vault. */
export function UnlockForm({ onUnlocked, children }: { onUnlocked: (vault: VaultData) => void; children?: ReactNode }) {
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const vault = await unlockVault(passphrase);
      setPassphrase("");
      onUnlocked(vault);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className={`${ui.card} ${ui.narrow}`}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {children ?? (
        <>
          <p className={ui.doneTitle}>Unlock your Bellaso</p>
          <p className={ui.hintLeft} style={{ marginTop: 8 }}>
            Your keys stay encrypted in this browser. A reload or a new tab locks them again, and your passphrase opens them.
          </p>
        </>
      )}
      <label htmlFor="unlock" className={ui.label} style={{ marginTop: 18 }}>
        Passphrase
      </label>
      <input
        id="unlock"
        type="password"
        className={ui.input}
        autoComplete="current-password"
        autoFocus
        value={passphrase}
        onChange={(event) => setPassphrase(event.target.value)}
      />
      <button type="submit" className={ui.primary} disabled={busy || passphrase.length === 0}>
        {busy ? "Unlocking…" : "Unlock"}
      </button>
      {error && (
        <p className={ui.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

/** The state of a recipient page without an open vault: nothing yet, locked, or still reading storage. */
export function VaultGate({ state, onUnlocked }: { state: VaultState; onUnlocked: (vault: VaultData) => void }) {
  if (state.kind === "loading") return null;
  if (state.kind === "none") {
    return (
      <div className={`${ui.card} ${ui.narrow}`}>
        <p className={ui.doneTitle}>No Bellaso in this browser</p>
        <p className={ui.hintLeft} style={{ marginTop: 8 }}>
          Your keys live only in the browser that made them. Create a Bellaso here, or restore one from its recovery phrase.
        </p>
        <Link href="/create" className={ui.primaryLink}>
          Create or restore
        </Link>
      </div>
    );
  }
  if (state.kind === "locked") return <UnlockForm onUnlocked={onUnlocked} />;
  return null;
}
