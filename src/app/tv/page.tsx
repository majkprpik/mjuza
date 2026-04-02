"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import YouTube, { YouTubeEvent } from "react-youtube";
import { supabase, Song } from "@/lib/supabase";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableItem({
  song,
  isPlaying,
  onRemove,
}: {
  song: Song;
  isPlaying: boolean;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: song.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-lg ${
        isPlaying ? "bg-purple-900/50 ring-1 ring-purple-500" : "bg-white/5 hover:bg-white/10"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-white/40 hover:text-white/70"
      >
        ⠿
      </button>
      {song.thumbnail && (
        <img
          src={song.thumbnail}
          alt=""
          className="w-12 h-9 rounded object-cover flex-shrink-0"
        />
      )}
      <span className="flex-1 truncate text-sm text-white/90">{song.title}</span>
      <button
        onClick={() => onRemove(song.id)}
        className="text-white/30 hover:text-red-400 text-lg px-2"
      >
        ×
      </button>
    </div>
  );
}

export default function TVPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const playerRef = useRef<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchSongs = useCallback(async () => {
    const { data } = await supabase
      .from("songs")
      .select("*")
      .order("order", { ascending: true });
    if (data) setSongs(data);
  }, []);

  useEffect(() => {
    fetchSongs();

    const channel = supabase
      .channel("songs-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "songs" },
        () => {
          fetchSongs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSongs]);

  // Keep currentIndex in bounds when songs change
  useEffect(() => {
    if (currentIndex >= songs.length && songs.length > 0) {
      setCurrentIndex(0);
    }
  }, [songs, currentIndex]);

  const currentSong = songs[currentIndex];

  const handleEnd = () => {
    if (songs.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % songs.length);
    }
  };

  const handleRemove = async (id: string) => {
    await supabase.from("songs").delete().eq("id", id);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = songs.findIndex((s) => s.id === active.id);
    const newIndex = songs.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(songs, oldIndex, newIndex);

    // Optimistic update
    setSongs(reordered);

    // Persist new order
    const updates = reordered.map((song, i) =>
      supabase.from("songs").update({ order: i }).eq("id", song.id)
    );
    await Promise.all(updates);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-black text-white">
      <div className="max-w-6xl mx-auto p-4 flex flex-col lg:flex-row gap-6">
        {/* Player */}
        <div className="flex-1">
          <h1 className="text-2xl font-bold mb-4 text-purple-400">📺 TV</h1>
          {currentSong ? (
            <div className="aspect-video bg-black rounded-xl overflow-hidden">
              <YouTube
                key={currentSong.youtube_id}
                videoId={currentSong.youtube_id}
                opts={{
                  width: "100%",
                  height: "100%",
                  playerVars: { autoplay: 1, controls: 1 },
                }}
                onEnd={handleEnd}
                onReady={(e: YouTubeEvent) => {
                  playerRef.current = e.target;
                }}
                className="w-full h-full"
                iframeClassName="w-full h-full"
              />
            </div>
          ) : (
            <div className="aspect-video bg-white/5 rounded-xl flex items-center justify-center text-white/30 text-lg">
              Nema pjesama -- dodaj ih na /user
            </div>
          )}
          {currentSong && (
            <p className="mt-3 text-lg font-medium truncate">
              {currentSong.title}
            </p>
          )}
        </div>

        {/* Playlist */}
        <div className="w-full lg:w-80">
          <h2 className="text-lg font-semibold mb-3 text-white/70">
            Playlist ({songs.length})
          </h2>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={songs.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {songs.map((song, i) => (
                  <SortableItem
                    key={song.id}
                    song={song}
                    isPlaying={i === currentIndex}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {songs.length === 0 && (
            <p className="text-white/30 text-sm">Lista je prazna.</p>
          )}
        </div>
      </div>
    </div>
  );
}
