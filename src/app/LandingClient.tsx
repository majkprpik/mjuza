"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getGuestId } from "@/lib/guest-identity";
import { User } from "@supabase/supabase-js";

export default function LandingClient() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [roomCode, setRoomCode] = useState("");
  const [roomName, setRoomName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Auth state
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // Check session on mount -- redirect logged in users to dashboard
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        router.replace("/dashboard");
      } else {
        setCheckingAuth(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        router.replace("/dashboard");
      } else {
        setUser(null);
        setCheckingAuth(false);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  const handleAuth = async () => {
    setAuthLoading(true);
    setAuthError("");
    if (authMode === "register") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setAuthError(error.message);
      }
      // onAuthStateChange will redirect to /dashboard
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message);
      }
      // onAuthStateChange will redirect to /dashboard
    }
    setAuthLoading(false);
  };

  const createRoom = async () => {
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName.trim() || "Nova Soba",
          guestId: getGuestId(),
          ownerId: user?.id || null,
        }),
      });
      const data = await res.json();
      if (data.code) {
        router.push(`/${data.code}`);
      } else {
        setError("Greska pri kreiranju sobe");
      }
    } catch {
      setError("Greska pri kreiranju sobe");
    }
    setCreating(false);
  };

  const joinRoom = () => {
    const code = roomCode.trim().toUpperCase();
    if (!code) return;
    router.push(`/${code}/add`);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#1db954] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-[#1db954] rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-[#1db954]/20">
            <svg width="28" height="28" viewBox="0 0 16 16" fill="white">
              <path d="M3 1.713a.7.7 0 011.05-.607l10.89 6.288a.7.7 0 010 1.212L4.05 14.894A.7.7 0 013 14.288V1.713z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Mjuza Do Suza</h1>
        </div>

        {/* Auth buttons */}
        <div className="mb-8">
          {authMode ? (
            <div className="bg-white/[0.04] rounded-xl p-4 ring-1 ring-white/[0.06] space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full bg-white/[0.06] rounded-lg px-4 py-3 text-sm text-white placeholder-white/25 outline-none ring-1 ring-white/[0.06] focus:ring-white/15 transition-all"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                placeholder="Lozinka"
                className="w-full bg-white/[0.06] rounded-lg px-4 py-3 text-sm text-white placeholder-white/25 outline-none ring-1 ring-white/[0.06] focus:ring-white/15 transition-all"
              />
              {authError && (
                <p className="text-red-400 text-xs">{authError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleAuth}
                  disabled={authLoading}
                  className="flex-1 bg-[#1db954] hover:bg-[#1ed760] text-black py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 transition-all"
                >
                  {authLoading
                    ? "..."
                    : authMode === "register"
                      ? "Registriraj se"
                      : "Prijavi se"}
                </button>
                <button
                  onClick={() => {
                    setAuthMode(null);
                    setAuthError("");
                  }}
                  className="px-4 py-2.5 rounded-lg text-sm text-white/40 hover:text-white/60 transition-colors"
                >
                  Odustani
                </button>
              </div>
              <button
                onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                className="text-xs text-white/30 hover:text-white/50 transition-colors w-full text-center"
              >
                {authMode === "login"
                  ? "Nemas account? Registriraj se"
                  : "Vec imas account? Prijavi se"}
              </button>
            </div>
          ) : (
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setAuthMode("login")}
                className="text-sm text-white/40 hover:text-white/70 transition-colors bg-white/[0.04] px-4 py-2 rounded-lg ring-1 ring-white/[0.06]"
              >
                Prijavi se
              </button>
              <button
                onClick={() => setAuthMode("register")}
                className="text-sm text-white/40 hover:text-white/70 transition-colors bg-white/[0.04] px-4 py-2 rounded-lg ring-1 ring-white/[0.06]"
              >
                Registriraj se
              </button>
            </div>
          )}
        </div>

        {/* Create Room */}
        <div className="mb-8">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.15em] text-white/40 mb-3 px-1">
            Kreiraj sobu
          </h2>
          <div className="space-y-3">
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Ime sobe (opcija)"
              className="w-full bg-white/[0.06] hover:bg-white/[0.08] focus:bg-white/[0.1] rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/25 outline-none ring-1 ring-white/[0.06] focus:ring-white/15 transition-all"
            />
            <button
              onClick={createRoom}
              disabled={creating}
              className="w-full bg-[#1db954] hover:bg-[#1ed760] active:scale-[0.98] text-black py-3.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-all shadow-lg shadow-[#1db954]/20 hover:shadow-[#1db954]/30"
            >
              {creating ? "Kreiram..." : "Kreiraj sobu"}
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-[11px] text-white/20 uppercase tracking-widest">ili</span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        {/* Join Room */}
        <div>
          <h2 className="text-[13px] font-bold uppercase tracking-[0.15em] text-white/40 mb-3 px-1">
            Pridruzi se
          </h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && joinRoom()}
              placeholder="Kod sobe"
              maxLength={5}
              className="flex-1 bg-white/[0.06] hover:bg-white/[0.08] focus:bg-white/[0.1] rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/25 outline-none ring-1 ring-white/[0.06] focus:ring-white/15 transition-all text-center tracking-[0.3em] uppercase font-bold"
            />
            <button
              onClick={joinRoom}
              className="bg-white/[0.06] hover:bg-white/[0.1] active:scale-95 px-7 py-3.5 rounded-xl text-sm font-bold transition-all ring-1 ring-white/[0.06]"
            >
              Idi
            </button>
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center mt-6">{error}</p>
        )}
      </div>
    </div>
  );
}
