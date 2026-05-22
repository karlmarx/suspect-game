import { useState, type ReactNode } from "react";
import { Glow } from "./Glow";
import { PrimaryButton } from "./PrimaryButton";
import { expectedPassword, getStoredPassword, setStoredPassword } from "../lib/password";

function isUnlocked(): boolean {
  const pw = expectedPassword();
  if (!pw) return true;
  return getStoredPassword() === pw;
}

export function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(isUnlocked);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  if (unlocked) return <>{children}</>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value === expectedPassword()) {
      setStoredPassword(value);
      setUnlocked(true);
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0f", color: "#e2e8f0" }}>
      <div
        className="relative mx-auto flex min-h-screen flex-col items-center justify-center overflow-hidden px-6"
        style={{ maxWidth: 560 }}
      >
        <Glow color="#f472b6" size={400} top={-100} left="10%" />
        <Glow color="#38bdf8" size={350} bottom={-60} right="10%" />

        <div
          className="font-mono uppercase tracking-[0.3em]"
          style={{ fontSize: 11, color: "#64748b", marginBottom: 10 }}
        >
          PRIVATE
        </div>
        <h1
          className="relative font-mono font-bold"
          style={{ fontSize: 44, letterSpacing: 10, marginBottom: 8 }}
        >
          SUSPECT
        </h1>
        <p
          className="italic"
          style={{ fontSize: 14, color: "#64748b", marginBottom: 32 }}
        >
          Enter the password to continue
        </p>

        <form onSubmit={submit} className="flex flex-col items-center gap-3">
          <input
            autoFocus
            type="password"
            value={value}
            onChange={(e) => {
              setError(false);
              setValue(e.target.value);
            }}
            placeholder="••••••••"
            className="text-center font-mono outline-none"
            style={{
              background: "#1e1e2e",
              border: `1.5px solid ${error ? "#ef4444" : "#334155"}`,
              color: "#e2e8f0",
              borderRadius: 10,
              padding: "14px 20px",
              fontSize: 18,
              letterSpacing: 6,
              width: 280,
            }}
          />
          {error && (
            <div className="font-mono" style={{ color: "#ef4444", fontSize: 12 }}>
              Incorrect password
            </div>
          )}
          <PrimaryButton type="submit" size="lg" variant="primary" disabled={value.length === 0}>
            UNLOCK
          </PrimaryButton>
        </form>
      </div>
    </div>
  );
}
