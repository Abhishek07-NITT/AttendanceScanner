"use client";

import { useState } from "react";

export default function LoginForm({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.sessionId) {
        onLoginSuccess(data.sessionId);
      } else {
        setError(data.error || "Invalid username or password");
      }
    } catch (err) {
      console.error("Login request error:", err);
      setError("Cannot reach server. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full h-[100dvh] flex flex-col items-center justify-center bg-[#050505] text-[#ededed] px-4 overflow-hidden select-none font-sans">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="relative z-10 w-full max-w-sm p-6 sm:p-8 rounded-2xl bg-[#0c0c0c] border border-[#1e1e1e] shadow-2xl backdrop-blur-xl">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-14 h-14 rounded-2xl bg-[#111111] border border-[#262626] flex items-center justify-center mb-4 shadow-inner">
            {/* Transfinitte SVG Logo */}
            <svg
              width="36"
              height="36"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow"
            >
              <g transform="translate(6, 12) scale(0.84)">
                <path
                  d="M0.918457 0.82C0.918457 0.367126 1.28801 0 1.74388 0H23.205C23.6609 0 24.0304 0.367127 24.0304 0.82V9.02C24.0304 9.47287 23.6609 9.84 23.205 9.84H1.74388C1.28801 9.84 0.918457 9.47287 0.918457 9.02V0.82Z"
                  fill="#FFFFFF"
                />
                <path
                  d="M26.5067 0.819999C26.5067 0.367126 26.8763 0 27.3321 0H61.1747C61.6305 0 62.0001 0.367127 62.0001 0.82V9.02C62.0001 9.47287 61.6305 9.84 61.1747 9.84H37.2373C36.7814 9.84 36.4118 10.2071 36.4118 10.66V40.18C36.4118 40.6329 36.0423 41 35.5864 41H27.3321C26.8763 41 26.5067 40.6329 26.5067 40.18V0.819999Z"
                  fill="#FFFFFF"
                />
              </g>
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-black tracking-widest text-white">
              TRANSFINITTE
            </h1>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#2e2e2e] bg-[#141414] text-[#888888]">
              26
            </span>
          </div>
          <p className="text-xs text-[#777777] mt-1 font-medium tracking-wide">
            Volunteer Attendance Portal
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-2.5 animate-fadeIn">
            <svg
              className="w-4 h-4 shrink-0 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="leading-tight">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#888888] mb-1.5">
              Username
            </label>
            <div className="relative">
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                disabled={loading}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#141414] border border-[#262626] text-sm text-white placeholder-[#555555] focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#888888] mb-1.5">
              Password
            </label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                disabled={loading}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#141414] border border-[#262626] text-sm text-white placeholder-[#555555] focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3 p-1 text-[#666666] hover:text-[#cccccc] transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-[#e0e0e0] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-black"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Signing In...</span>
              </>
            ) : (
              <span>Unlock Scanner</span>
            )}
          </button>
        </form>

        <p className="text-[10px] text-center text-[#555555] mt-6 tracking-wide">
          Authorized volunteers only • Multi-device access supported
        </p>
      </div>
    </div>
  );
}

