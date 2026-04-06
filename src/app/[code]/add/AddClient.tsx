"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, Song, Room } from "@/lib/supabase";
import { getGuestId, getGuestName, setGuestName } from "@/lib/guest-identity";

type SearchResult = {
  videoId: string;
  title: string;
  thumbnail: string;
  spotifyMeta?: {
    artist: string;
    trackName: string;
    albumArt: string;
  };
};

export default function AddClient({ roomCode }: { roomCode: string }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [guestId] = useState(() => getGuestId());
  const [displayName, setDisplayName] = useState(() => getGuestName());
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nowPlayingId, setNowPlayingId] = useState<string | null>(null);

  // Fetch room
  useEffect(() => {
    supabase
      .from("rooms")
      .select("*")
      .eq("code", roomCode)
      .single()
      .then(({ data }) => {
        if (data) {
          setRoom(data);
          setNowPlayingId(data.now_playing_song_id);
        }
      });
  }, [roomCode]);

  // Register as member + update last_seen
  useEffect(() => {
    if (!room) return;
    supabase
      .from("room_members")
      .upsert(
        {
          room_id: room.id,
          guest_id: guestId,
          display_name: displayName,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "room_id,guest_id" }
      );
  }, [room, guestId, displayName]);

  const fetchSongs = useCallback(async () => {
    if (!room) return;
    const { data } = await supabase
      .from("songs")
      .select("*")
      .eq("room_id", room.id)
      .order("order", { ascending: true });
    if (data) {
      setSongs(data);
      setAddedIds(new Set(data.map((s) => s.youtube_id)));
    }
  }, [room]);

  useEffect(() => {
    if (!room) return;
    fetchSongs();

    const songsChannel = supabase
      .channel(`songs-room-user-${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "songs", filter: `room_id=eq.${room.id}` },
        () => fetchSongs()
      )
      .subscribe();

    const roomChannel = supabase
      .channel(`room-updates-${room.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        (payload) => {
          const updated = payload.new as Room;
          setNowPlayingId(updated.now_playing_song_id);
          if (updated.archived_at) setRoom(updated);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(songsChannel);
      supabase.removeChannel(roomChannel);
    };
  }, [room, fetchSongs]);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.items || []);
    } catch {
      setResults([]);
    }
    setLoading(false);
  };

  const addSong = async (result: SearchResult) => {
    if (addedIds.has(result.videoId) || !room) return;
    const maxOrder = songs.length > 0 ? Math.max(...songs.map((s) => s.order)) : -1;
    await supabase.from("songs").insert({
      youtube_id: result.videoId,
      title: result.title,
      thumbnail: result.thumbnail,
      order: maxOrder + 1,
      room_id: room.id,
      added_by_guest_id: guestId,
      added_by_name: displayName,
    });
    setAddedIds((prev) => new Set(prev).add(result.videoId));
  };

  const removeSong = async (id: string) => {
    await supabase.from("songs").delete().eq("id", id);
  };

  const saveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed) {
      setDisplayName(trimmed);
      setGuestName(trimmed);
    }
    setEditingName(false);
  };

  const isArchived = !!room?.archived_at;

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white/30">
        Ucitavam...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-2xl bg-[#0a0a0a]/80 border-b border-white/[0.04]">
        <div className="max-w-xl mx-auto px-5 pt-6 pb-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#1db954] rounded-xl flex items-center justify-center shadow-lg shadow-[#1db954]/20">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                  <path d="M3 1.713a.7.7 0 011.05-.607l10.89 6.288a.7.7 0 010 1.212L4.05 14.894A.7.7 0 013 14.288V1.713z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight leading-tight">{room.name}</h1>
                <p className="text-[11px] text-white/30">Kod: {roomCode}</p>
              </div>
            </div>

            {/* Guest name */}
            <div className="flex items-center gap-2">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveName()}
                    autoFocus
                    className="bg-white/[0.06] rounded-lg px-3 py-1.5 text-xs text-white outline-none ring-1 ring-white/[0.1] w-32"
                  />
                  <button onClick={saveName} className="text-[#1db954] text-xs font-bold">
                    OK
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setNameInput(displayName);
                    setEditingName(true);
                  }}
                  className="text-xs text-white/40 hover:text-white/60 transition-colors bg-white/[0.04] px-3 py-1.5 rounded-lg"
                >
                  {displayName}
                </button>
              )}
            </div>
          </div>

          {isArchived && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 mb-4 text-yellow-200 text-sm">
              Ova soba je arhivirana -- ne moze se vise dodavati.
            </div>
          )}

          {!isArchived && (
            <div className="flex gap-3">
              <div className="flex-1 relative group">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 group-focus-within:text-white/50 transition-colors" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85a1.007 1.007 0 00-.115-.1zM12 6.5a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search()}
                  placeholder="Sto zelis slusati?"
                  className="w-full bg-white/[0.06] hover:bg-white/[0.08] focus:bg-white/[0.1] rounded-xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-white/25 outline-none ring-1 ring-white/[0.06] focus:ring-white/15 transition-all"
                />
              </div>
              <button
                onClick={search}
                disabled={loading}
                className="bg-[#1db954] hover:bg-[#1ed760] active:scale-95 text-black px-7 py-3.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-all shadow-lg shadow-[#1db954]/20 hover:shadow-[#1db954]/30"
              >
                {loading ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" />
                  </svg>
                ) : (
                  "Trazi"
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-xl mx-auto px-5 pb-32 pt-6">
        {/* Search Results */}
        {results.length > 0 && !isArchived && (
          <div className="mb-10">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.15em] text-white/40 mb-3 px-1">
              Rezultati
            </h2>
            <div className="space-y-1">
              {results.map((r) => {
                const isAdded = addedIds.has(r.videoId);
                return (
                  <button
                    key={r.videoId}
                    onClick={() => addSong(r)}
                    disabled={isAdded}
                    className={`group w-full flex items-center gap-3.5 p-3 rounded-xl text-left transition-all duration-200 ${
                      isAdded ? "opacity-40" : "hover:bg-white/[0.05] active:scale-[0.99]"
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <img src={r.thumbnail} alt="" className="w-14 h-14 rounded-lg object-cover shadow-md" />
                      {!isAdded && (
                        <div className="absolute inset-0 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200">
                          <div className="w-8 h-8 bg-[#1db954] rounded-full flex items-center justify-center shadow-lg">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
                              <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block text-[13px] font-medium truncate text-white/90">
                        {r.spotifyMeta?.trackName || r.title}
                      </span>
                      {r.spotifyMeta?.artist && (
                        <span className="block text-[11px] text-white/40 truncate">
                          {r.spotifyMeta.artist}
                        </span>
                      )}
                    </div>
                    {isAdded && (
                      <div className="flex items-center gap-1.5 text-[#1db954]">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M13.985 2.383L5.127 12.754 1.388 8.375l-.658.77 4.397 5.149 9.618-11.262z" />
                        </svg>
                        <span className="text-[11px] font-medium">Dodano</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Now Playing */}
        {nowPlayingId && songs.find((s) => s.id === nowPlayingId) && (
          <div className="mb-6">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.15em] text-white/40 mb-3 px-1">
              Sad svira
            </h2>
            {(() => {
              const playing = songs.find((s) => s.id === nowPlayingId)!;
              return (
                <div className="flex items-center gap-3.5 p-3 rounded-xl bg-[#1db954]/10 border border-[#1db954]/20">
                  <div className="flex items-end gap-[2px] h-4 flex-shrink-0">
                    <span className="w-[3px] bg-[#1db954] rounded-full animate-pulse" style={{ height: "10px", animationDelay: "0ms" }} />
                    <span className="w-[3px] bg-[#1db954] rounded-full animate-pulse" style={{ height: "16px", animationDelay: "150ms" }} />
                    <span className="w-[3px] bg-[#1db954] rounded-full animate-pulse" style={{ height: "8px", animationDelay: "300ms" }} />
                  </div>
                  {playing.thumbnail && (
                    <img src={playing.thumbnail} alt="" className="w-11 h-11 rounded-lg object-cover shadow-md" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate text-[#1db954]">{playing.title}</p>
                    {playing.added_by_name && (
                      <p className="text-[11px] text-white/30 truncate">dodao/la {playing.added_by_name}</p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Current Queue */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.15em] text-white/40">
              Red pustanja
            </h2>
            <span className="text-[11px] text-white/20 bg-white/[0.05] px-2.5 py-1 rounded-full font-medium">
              {songs.length}
            </span>
          </div>
          <div className="space-y-1">
            {songs.map((song, i) => {
              const isNowPlaying = song.id === nowPlayingId;
              return (
                <div
                  key={song.id}
                  className={`group flex items-center gap-3.5 p-3 rounded-xl transition-all duration-200 ${
                    isNowPlaying
                      ? "bg-[#1db954]/10 border border-[#1db954]/20"
                      : "hover:bg-white/[0.05] border border-transparent"
                  }`}
                >
                  <span className={`w-5 text-center text-[11px] tabular-nums flex-shrink-0 ${isNowPlaying ? "text-[#1db954]" : "text-white/20"}`}>
                    {isNowPlaying ? (
                      <div className="flex items-end justify-center gap-[2px] h-4">
                        <span className="w-[2px] bg-[#1db954] rounded-full animate-pulse" style={{ height: "8px" }} />
                        <span className="w-[2px] bg-[#1db954] rounded-full animate-pulse" style={{ height: "12px", animationDelay: "150ms" }} />
                        <span className="w-[2px] bg-[#1db954] rounded-full animate-pulse" style={{ height: "6px", animationDelay: "300ms" }} />
                      </div>
                    ) : (
                      i + 1
                    )}
                  </span>
                  {song.thumbnail && (
                    <img src={song.thumbnail} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0 shadow-md" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className={`block text-[13px] font-medium truncate ${isNowPlaying ? "text-[#1db954]" : "text-white/90"}`}>
                      {song.title}
                    </span>
                    {song.added_by_name && (
                      <span className="block text-[11px] text-white/25 truncate">{song.added_by_name}</span>
                    )}
                  </div>
                  {!isArchived && (
                    <button
                      onClick={() => removeSong(song.id)}
                      className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all p-1.5 rounded-lg hover:bg-white/5"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
            {songs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-white/15">
                <div className="w-16 h-16 rounded-full bg-white/[0.03] flex items-center justify-center mb-4">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-white/25">Trazi pjesmu i dodaj u red</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
