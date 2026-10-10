"use client";

import { useState, useEffect, useCallback } from "react";
import ZXingScanner from "@/components/ZXingScanner";
import LoginForm from "@/components/LoginForm";

export default function Home() {
  const [authState, setAuthState] = useState("loading"); // "loading" | "unauthenticated" | "authenticated"
  const [sessionId, setSessionId] = useState(null);

  // Check stored session on mount
  useEffect(() => {
    async function checkExistingSession() {
      const stored = typeof window !== "undefined" ? localStorage.getItem("tf_session_id") : null;
      if (!stored) {
        setAuthState("unauthenticated");
        return;
      }

      try {
        const res = await fetch("/api/auth/verify", {
          headers: { "x-session-id": stored },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.valid) {
            setSessionId(stored);
            setAuthState("authenticated");
            return;
          }
        }
      } catch (err) {
        console.error("Session verification failed:", err);
      }

      // If invalid or network failed, clear and show login
      localStorage.removeItem("tf_session_id");
      setAuthState("unauthenticated");
    }

    checkExistingSession();
  }, []);

  const handleLoginSuccess = useCallback((newSessionId) => {
    localStorage.setItem("tf_session_id", newSessionId);
    setSessionId(newSessionId);
    setAuthState("authenticated");
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    localStorage.removeItem("tf_session_id");
    setSessionId(null);
    setAuthState("unauthenticated");
  }, []);

  // Loading splash state
  if (authState === "loading") {
    return (
      <div className="w-full h-[100dvh] flex flex-col items-center justify-center bg-[#050505] text-[#ededed]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#111111] border border-[#222222] flex items-center justify-center animate-pulse">
            <span className="font-extrabold text-sm tracking-wider text-white">TF</span>
          </div>
          <span className="text-xs font-mono text-[#666666] tracking-widest">
            AUTHENTICATING...
          </span>
        </div>
      </div>
    );
  }

  // Not logged in: QR scanner is NEVER visible or mounted
  if (authState === "unauthenticated") {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  // Logged in: Render scanner with active session
  return <ZXingScanner sessionId={sessionId} onLogout={handleLogout} />;
}