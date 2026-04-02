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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "songs" },
        () => fetchSongs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSongs]);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/youtube/search?q=${encodeURIComponent(query)}`
      );
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
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-black text-white">
      <div className="max-w-lg mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4 text-purple-400">
          Dodaj pjesmu
        </h1>

        {/* Search */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Trazi na YouTubeu..."
            className="flex-1 bg-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={search}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? "..." : "Trazi"}
          </button>
        </div>

        {/* Search Results */}
        {results.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-white/50 mb-2">
              Rezultati
            </h2>
            <div className="space-y-2">
              {results.map((r) => (
                <button
                  key={r.videoId}
                  onClick={() => addSong(r)}
                  disabled={addedIds.has(r.videoId)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition ${
                    addedIds.has(r.videoId)
                      ? "bg-green-900/20 opacity-60"
                      : "bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <img
                    src={r.thumbnail}
                    alt=""
                    className="w-16 h-12 rounded object-cover flex-shrink-0"
                  />
                  <span className="flex-1 text-sm truncate">{r.title}</span>
                  {addedIds.has(r.videoId) ? (
                    <span className="text-green-400 text-xs">Dodano</span>
                  ) : (
                    <span className="text-purple-400 text-xl">+</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current Playlist */}
        <div>
          <h2 className="text-sm font-semibold text-white/50 mb-2">
            Trenutna lista ({songs.length})
          </h2>
          <div className="space-y-2">
            {songs.map((song) => (
              <div
                key={song.id}
                className="flex items-center gap-3 p-3 bg-white/5 rounded-lg"
              >
                {song.thumbnail && (
                  <img
                    src={song.thumbnail}
                    alt=""
                    className="w-12 h-9 rounded object-cover flex-shrink-0"
                  />
                )}
                <span className="flex-1 text-sm truncate">{song.title}</span>
                <button
                  onClick={() => removeSong(song.id)}
                  className="text-white/30 hover:text-red-400 text-lg px-2"
                >
                  ×
                </button>
              </div>
            ))}
            {songs.length === 0 && (
              <p className="text-white/30 text-sm">
                Nema pjesama. Trazi i dodaj!
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
