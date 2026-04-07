"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase, Room, Profile } from "@/lib/supabase";
import { getGuestId } from "@/lib/guest-identity";
import { User } from "@supabase/supabase-js";

type FriendWithProfile = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  sender?: Profile;
  receiver?: Profile;
};

type FriendStatus = {
  profile: Profile;
  friendshipId: string;
  roomName?: string;
  roomCode?: string;
};

type PendingRequest = {
  id: string;
  sender_id: string;
  sender?: Profile;
};

type Tab = "sobe" | "prijatelji";

export default function DashboardClient() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<Tab>("sobe");

  // Username setup
  const [needsUsername, setNeedsUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);

  // Rooms
  const [myRooms, setMyRooms] = useState<Room[]>([]);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editRoomName, setEditRoomName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [creating, setCreating] = useState(false);

  // Friends
  const [friends, setFriends] = useState<FriendStatus[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<{ id: string; receiver?: Profile }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/");
        return;
      }
      setUser(data.user);
    });
  }, [router]);

  // Fetch profile
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile(data);
          if (!data.username) setNeedsUsername(true);
        }
      });
  }, [user]);

  // Fetch rooms
  useEffect(() => {
    if (!user) return;
    supabase
      .from("rooms")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setMyRooms(data);
      });
  }, [user]);

  // Fetch friends
  const fetchFriends = useCallback(async () => {
    if (!user) return;
    const res = await fetch(`/api/friends?userId=${user.id}`);
    const data = await res.json();

    // Map accepted friendships to friend profiles
    const friendList: FriendStatus[] = (data.friends || []).map(
      (f: FriendWithProfile) => {
        const friendProfile =
          f.sender_id === user.id ? f.receiver : f.sender;
        return {
          profile: friendProfile!,
          friendshipId: f.id,
        };
      }
    );

    // Fetch current room for each friend
    for (const friend of friendList) {
      const { data: memberData } = await supabase
        .from("room_members")
        .select("room_id")
        .eq("user_id", friend.profile.id)
        .gte(
          "last_seen_at",
          new Date(Date.now() - 5 * 60 * 1000).toISOString()
        )
        .order("last_seen_at", { ascending: false })
        .limit(1);

      if (memberData && memberData.length > 0) {
        const { data: roomData } = await supabase
          .from("rooms")
          .select("name, code")
          .eq("id", memberData[0].room_id)
          .single();
        if (roomData) {
          friend.roomName = roomData.name;
          friend.roomCode = roomData.code;
        }
      }
    }

    setFriends(friendList);
    setPendingRequests(data.pending || []);
    setSentRequests(data.sent || []);
  }, [user]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const saveUsername = async () => {
    const trimmed = usernameInput.trim().toLowerCase();
    if (!trimmed || trimmed.length < 3) {
      setUsernameError("Minimalno 3 znaka");
      return;
    }
    if (!/^[a-z0-9_]+$/.test(trimmed)) {
      setUsernameError("Samo slova, brojevi i _");
      return;
    }
    setSavingUsername(true);
    setUsernameError("");

    const { error } = await supabase
      .from("profiles")
      .update({ username: trimmed })
      .eq("id", user!.id);

    if (error) {
      setUsernameError(
        error.message.includes("unique")
          ? "Username je zauzet"
          : error.message
      );
    } else {
      setProfile((p) => (p ? { ...p, username: trimmed } : p));
      setNeedsUsername(false);
    }
    setSavingUsername(false);
  };

  const createRoom = async () => {
    setCreating(true);
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
    }
    setCreating(false);
  };

  const renameRoom = async (roomId: string) => {
    const trimmed = editRoomName.trim();
    if (!trimmed) {
      setEditingRoomId(null);
      return;
    }
    await supabase.from("rooms").update({ name: trimmed }).eq("id", roomId);
    setMyRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, name: trimmed } : r))
    );
    setEditingRoomId(null);
  };

  const searchFriends = async () => {
    if (!searchQuery.trim() || !user) return;
    setSearching(true);
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "search",
        senderId: user.id,
        query: searchQuery,
      }),
    });
    const data = await res.json();
    setSearchResults(data.results || []);
    setSearching(false);
  };

  const sendRequest = async (receiverId: string) => {
    if (!user) return;
    setSendingTo(receiverId);
    await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send",
        senderId: user.id,
        receiverId,
      }),
    });
    setSendingTo(null);
    setSearchResults((prev) => prev.filter((p) => p.id !== receiverId));
  };

  const respondRequest = async (
    friendshipId: string,
    status: "accepted" | "rejected"
  ) => {
    await fetch(`/api/friends/${friendshipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchFriends();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#1db954] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Username setup modal
  if (needsUsername) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-5">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#1db954] rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-[#1db954]/20">
              <svg width="28" height="28" viewBox="0 0 16 16" fill="white">
                <path d="M3 1.713a.7.7 0 011.05-.607l10.89 6.288a.7.7 0 010 1.212L4.05 14.894A.7.7 0 013 14.288V1.713z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold">Odaberi username</h1>
            <p className="text-sm text-white/30 mt-2">
              Prijatelji te mogu pronaci po usernameu
            </p>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              value={usernameInput}
              onChange={(e) =>
                setUsernameInput(e.target.value.toLowerCase().replace(/\s/g, "_"))
              }
              onKeyDown={(e) => e.key === "Enter" && saveUsername()}
              placeholder="username"
              className="w-full bg-white/[0.06] rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/25 outline-none ring-1 ring-white/[0.06] focus:ring-white/15 transition-all text-center"
            />
            {usernameError && (
              <p className="text-red-400 text-xs text-center">{usernameError}</p>
            )}
            <button
              onClick={saveUsername}
              disabled={savingUsername}
              className="w-full bg-[#1db954] hover:bg-[#1ed760] text-black py-3.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-all shadow-lg shadow-[#1db954]/20"
            >
              {savingUsername ? "Spremam..." : "Spremi"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-2xl bg-[#0a0a0a]/80 border-b border-white/[0.04]">
        <div className="max-w-2xl mx-auto px-5 pt-6 pb-4">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#1db954] rounded-xl flex items-center justify-center shadow-lg shadow-[#1db954]/20">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                  <path d="M3 1.713a.7.7 0 011.05-.607l10.89 6.288a.7.7 0 010 1.212L4.05 14.894A.7.7 0 013 14.288V1.713z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight leading-tight">
                  {profile?.username || user.email}
                </h1>
                <p className="text-[11px] text-white/30">{user.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="text-xs text-white/30 hover:text-white/60 transition-colors bg-white/[0.04] px-3 py-1.5 rounded-lg"
            >
              Odjavi se
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {(["sobe", "prijatelji"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t
                    ? "bg-white/[0.1] text-white"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {t === "sobe" ? "Sobe" : "Prijatelji"}
                {t === "prijatelji" && pendingRequests.length > 0 && (
                  <span className="ml-2 bg-[#1db954] text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {pendingRequests.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6">
        {/* === SOBE TAB === */}
        {tab === "sobe" && (
          <div>
            {/* Create room */}
            <div className="flex gap-3 mb-6">
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createRoom()}
                placeholder="Ime nove sobe"
                className="flex-1 bg-white/[0.06] hover:bg-white/[0.08] focus:bg-white/[0.1] rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none ring-1 ring-white/[0.06] focus:ring-white/15 transition-all"
              />
              <button
                onClick={createRoom}
                disabled={creating}
                className="bg-[#1db954] hover:bg-[#1ed760] active:scale-95 text-black px-6 py-3 rounded-xl text-sm font-bold disabled:opacity-50 transition-all shadow-lg shadow-[#1db954]/20"
              >
                {creating ? "..." : "Kreiraj"}
              </button>
            </div>

            {/* Room list */}
            <div className="space-y-1">
              {myRooms.map((room) => (
                <div
                  key={room.id}
                  className="flex items-center gap-2 p-3.5 rounded-xl hover:bg-white/[0.05] transition-all group"
                >
                  {editingRoomId === room.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editRoomName}
                        onChange={(e) => setEditRoomName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameRoom(room.id);
                          if (e.key === "Escape") setEditingRoomId(null);
                        }}
                        autoFocus
                        className="flex-1 bg-white/[0.06] rounded-lg px-3 py-1.5 text-sm text-white outline-none ring-1 ring-white/[0.1]"
                      />
                      <button
                        onClick={() => renameRoom(room.id)}
                        className="text-[#1db954] text-xs font-bold"
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => router.push(`/${room.code}`)}
                        className="flex-1 text-left min-w-0"
                      >
                        <p className="text-sm font-medium text-white/90 truncate">
                          {room.name}
                        </p>
                        <p className="text-[11px] text-white/30 mt-0.5">
                          {room.code}
                          <span className="mx-1.5">·</span>
                          {new Date(room.created_at).toLocaleDateString(
                            "hr-HR",
                            { day: "numeric", month: "short", year: "numeric" }
                          )}{" "}
                          {new Date(room.created_at).toLocaleTimeString(
                            "hr-HR",
                            { hour: "2-digit", minute: "2-digit" }
                          )}
                          {room.archived_at && (
                            <span className="text-yellow-500/60 ml-2">
                              arhivirana
                            </span>
                          )}
                        </p>
                      </button>
                      <button
                        onClick={() => {
                          setEditingRoomId(room.id);
                          setEditRoomName(room.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-white/50 transition-all p-1.5 rounded-lg hover:bg-white/5"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                        >
                          <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L3.463 11.1l-.589 2.065 2.066-.59 8.61-8.61a.25.25 0 000-.353L12.427 2.487z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => router.push(`/${room.code}`)}
                        className="text-white/15 group-hover:text-white/40 transition-colors flex-shrink-0"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                        >
                          <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              ))}
              {myRooms.length === 0 && (
                <div className="text-center py-12 text-white/20">
                  <p className="text-sm">Nemas jos nijednu sobu</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* === PRIJATELJI TAB === */}
        {tab === "prijatelji" && (
          <div>
            {/* Search / Add friend */}
            <div className="flex gap-3 mb-6">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchFriends()}
                placeholder="Trazi po usernameu ili emailu"
                className="flex-1 bg-white/[0.06] hover:bg-white/[0.08] focus:bg-white/[0.1] rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none ring-1 ring-white/[0.06] focus:ring-white/15 transition-all"
              />
              <button
                onClick={searchFriends}
                disabled={searching}
                className="bg-[#1db954] hover:bg-[#1ed760] active:scale-95 text-black px-6 py-3 rounded-xl text-sm font-bold disabled:opacity-50 transition-all shadow-lg shadow-[#1db954]/20"
              >
                {searching ? "..." : "Trazi"}
              </button>
            </div>

            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="mb-8">
                <h3 className="text-[13px] font-bold uppercase tracking-[0.15em] text-white/40 mb-3 px-1">
                  Rezultati
                </h3>
                <div className="space-y-1">
                  {searchResults.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3.5 rounded-xl hover:bg-white/[0.05] transition-all"
                    >
                      <div>
                        <p className="text-sm font-medium text-white/90">
                          {p.username || p.email}
                        </p>
                        {p.username && p.email && (
                          <p className="text-[11px] text-white/30">
                            {p.email}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => sendRequest(p.id)}
                        disabled={sendingTo === p.id}
                        className="bg-[#1db954] hover:bg-[#1ed760] text-black px-4 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 transition-all"
                      >
                        {sendingTo === p.id ? "..." : "Dodaj"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending requests */}
            {pendingRequests.length > 0 && (
              <div className="mb-8">
                <h3 className="text-[13px] font-bold uppercase tracking-[0.15em] text-white/40 mb-3 px-1">
                  Zahtjevi
                </h3>
                <div className="space-y-1">
                  {pendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] ring-1 ring-white/[0.06]"
                    >
                      <div>
                        <p className="text-sm font-medium text-white/90">
                          {req.sender?.username || "Nepoznat"}
                        </p>
                        {req.sender?.display_name && (
                          <p className="text-[11px] text-white/30">
                            {req.sender.display_name}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => respondRequest(req.id, "accepted")}
                          className="bg-[#1db954] hover:bg-[#1ed760] text-black px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
                        >
                          Prihvati
                        </button>
                        <button
                          onClick={() => respondRequest(req.id, "rejected")}
                          className="bg-white/[0.06] hover:bg-white/[0.1] text-white/50 px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
                        >
                          Odbij
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sent requests */}
            {sentRequests.length > 0 && (
              <div className="mb-8">
                <h3 className="text-[13px] font-bold uppercase tracking-[0.15em] text-white/40 mb-3 px-1">
                  Poslano
                </h3>
                <div className="space-y-1">
                  {sentRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] ring-1 ring-white/[0.06]"
                    >
                      <div>
                        <p className="text-sm font-medium text-white/90">
                          {req.receiver?.username || req.receiver?.email || "Nepoznat"}
                        </p>
                        {req.receiver?.username && req.receiver?.email && (
                          <p className="text-[11px] text-white/30">
                            {req.receiver.email}
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] text-white/25 bg-white/[0.04] px-3 py-1 rounded-full">
                        Ceka odgovor
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Friends list */}
            <div>
              <h3 className="text-[13px] font-bold uppercase tracking-[0.15em] text-white/40 mb-3 px-1">
                Prijatelji
              </h3>
              <div className="space-y-1">
                {friends.map((f) => (
                  <div
                    key={f.friendshipId}
                    className={`flex items-center justify-between p-3.5 rounded-xl transition-all ${
                      f.roomCode
                        ? "hover:bg-[#1db954]/5 cursor-pointer"
                        : "hover:bg-white/[0.03]"
                    }`}
                    onClick={() =>
                      f.roomCode && router.push(`/${f.roomCode}/add`)
                    }
                  >
                    <div>
                      <p className="text-sm font-medium text-white/90">
                        {f.profile.username || "Nepoznat"}
                      </p>
                      {f.roomName ? (
                        <p className="text-[11px] text-[#1db954] mt-0.5">
                          Slusa: {f.roomName} ({f.roomCode})
                        </p>
                      ) : (
                        <p className="text-[11px] text-white/20 mt-0.5">
                          Offline
                        </p>
                      )}
                    </div>
                    {f.roomCode && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="text-[#1db954]/40"
                      >
                        <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
                      </svg>
                    )}
                  </div>
                ))}
                {friends.length === 0 && (
                  <div className="text-center py-12 text-white/20">
                    <p className="text-sm">Nemas jos prijatelja</p>
                    <p className="text-xs text-white/15 mt-1">
                      Trazi ih po usernameu gore
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
