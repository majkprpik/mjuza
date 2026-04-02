"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, Song } from "@/lib/supabase";

type SearchResult = {
  videoId: string;
  title: string;
  thumbnail: string;
};

export default function UserPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const fetchSongs = useCallback(async () => {
    const { data } = await supabase
      .from("songs")
      .select("*")
      .order("order", { ascending: true });
    if (data) {
      setSongs(data);
      setAddedIds(new Set(data.map((s) => s.youtube_id)));
    }
  }, []);

  useEffect(() => {
    fetchSongs();
    const channel = supabase
      .channel("songs-realtime-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "songs" }, () => fetchSongs())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchSongs]);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.items || []);
    } catch {
      setResults([]);
    }
    setLoading(false);
  };

  const addSong = async (result: SearchResult) => {
    if (addedIds.has(result.videoId)) return;
    const maxOrder = songs.length > 0 ? Math.max(...songs.map((s) => s.order)) : -1;
    await supabase.from("songs").insert({
      youtube_id: result.videoId,
      title: result.title,
      thumbnail: result.thumbnail,
      order: maxOrder + 1,
    });
    setAddedIds((prev) => new Set(prev).add(result.videoId));
  };

  const removeSong = async (id: string) => {
    await supabase.from("songs").delete().eq("id", id);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-b from-[#1a1a1a] to-black/95 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 bg-[#1db954] rounded-full flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                <path d="M3 1.713a.7.7 0 011.05-.607l10.89 6.288a.7.7 0 010 1.212L4.05 14.894A.7.7 0 013 14.288V1.713z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight">Mjuza Do Suza(2)</h1>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6a6a6a]" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85a1.007 1.007 0 00-.115-.1zM12 6.5a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                placeholder="Sto zelis slusati?"
                className="w-full bg-[#242424] rounded-full pl-10 pr-4 py-3 text-sm text-white placeholder-[#6a6a6a] outline-none focus:ring-2 focus:ring-white/20 transition-all"
              />
            </div>
            <button
              onClick={search}
              disabled={loading}
              className="bg-[#1db954] hover:bg-[#1ed760] text-black px-6 py-3 rounded-full text-sm font-bold disabled:opacity-50 transition-colors"
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
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-32">
        {/* Search Results */}
        {results.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#b3b3b3] mb-3 px-1">
              Rezultati pretrage
            </h2>
            <div className="space-y-1">
              {results.map((r) => {
                const isAdded = addedIds.has(r.videoId);
                return (
                  <button
                    key={r.videoId}
                    onClick={() => addSong(r)}
                    disabled={isAdded}
                    className={`group w-full flex items-center gap-3 p-2.5 rounded-md text-left transition-all duration-150 ${
                      isAdded ? "opacity-50" : "hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <img src={r.thumbnail} alt="" className="w-12 h-12 rounded object-cover" />
                      {!isAdded && (
                        <div className="absolute inset-0 bg-black/60 rounded opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <svg width="20" height="20" viewBox="0 0 16 16" fill="white">
                            <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <span className="flex-1 text-sm font-medium truncate text-white">
                      {r.title}
                    </span>
                    {isAdded && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="#1db954">
                        <path d="M13.985 2.383L5.127 12.754 1.388 8.375l-.658.77 4.397 5.149 9.618-11.262z" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Current Queue */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#b3b3b3]">
              Red pustanja
            </h2>
            <span className="text-xs text-[#6a6a6a]">{songs.length} pjesama</span>
          </div>
          <div className="space-y-1">
            {songs.map((song, i) => (
              <div
                key={song.id}
                className="group flex items-center gap-3 p-2.5 rounded-md hover:bg-white/[0.06] transition-all duration-150"
              >
                <span className="w-5 text-center text-xs text-[#6a6a6a] flex-shrink-0">
                  {i + 1}
                </span>
                {song.thumbnail && (
                  <img src={song.thumbnail} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                )}
                <span className="flex-1 text-sm font-medium truncate text-white">{song.title}</span>
                <button
                  onClick={() => removeSong(song.id)}
                  className="opacity-0 group-hover:opacity-100 text-[#6a6a6a] hover:text-white transition-all p-1"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2.5 4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zM5 2a1 1 0 011-1h4a1 1 0 011 1v1H5V2zm-1.5 4a.5.5 0 01.5.5v6a1 1 0 001 1h6a1 1 0 001-1v-6a.5.5 0 011 0v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a.5.5 0 01.5-.5z" />
                  </svg>
                </button>
              </div>
            ))}
            {songs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-[#6a6a6a]">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
                <p className="text-sm">Trazi pjesmu i dodaj u red</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
