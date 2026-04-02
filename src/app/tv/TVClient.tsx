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
  index,
  onRemove,
  onPlay,
}: {
  song: Song;
  isPlaying: boolean;
  index: number;
  onRemove: (id: string) => void;
  onPlay: (index: number) => void;
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
      onClick={() => onPlay(index)}
      className={`group flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 ${
        isPlaying
          ? "bg-gradient-to-r from-[#1db954]/20 to-transparent border border-[#1db954]/20"
          : "hover:bg-white/[0.05] border border-transparent"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="cursor-grab active:cursor-grabbing text-white/20 hover:text-white/50 flex-shrink-0 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="4" cy="3" r="1.2" />
          <circle cx="10" cy="3" r="1.2" />
          <circle cx="4" cy="7" r="1.2" />
          <circle cx="10" cy="7" r="1.2" />
          <circle cx="4" cy="11" r="1.2" />
          <circle cx="10" cy="11" r="1.2" />
        </svg>
      </button>

      <div className="w-5 text-center flex-shrink-0">
        {isPlaying ? (
          <div className="flex items-end justify-center gap-[2px] h-4">
            <span className="w-[3px] bg-[#1db954] rounded-full animate-pulse" style={{ height: "10px", animationDelay: "0ms" }} />
            <span className="w-[3px] bg-[#1db954] rounded-full animate-pulse" style={{ height: "16px", animationDelay: "150ms" }} />
            <span className="w-[3px] bg-[#1db954] rounded-full animate-pulse" style={{ height: "8px", animationDelay: "300ms" }} />
          </div>
        ) : (
          <span className="text-white/25 text-xs tabular-nums">{index + 1}</span>
        )}
      </div>

      {song.thumbnail && (
        <img
          src={song.thumbnail}
          alt=""
          className="w-11 h-11 rounded-lg object-cover flex-shrink-0 shadow-md"
        />
      )}

      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-semibold truncate leading-tight ${isPlaying ? "text-[#1db954]" : "text-white/90"}`}>
          {song.title}
        </p>
        {isPlaying && <p className="text-[11px] text-[#1db954]/60 mt-0.5">Svira</p>}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(song.id);
        }}
        className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all p-1.5 rounded-lg hover:bg-white/5"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
        </svg>
      </button>
    </div>
  );
}

export default function TVPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const playerRef = useRef<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
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
      .on("postgres_changes", { event: "*", schema: "public", table: "songs" }, () => fetchSongs())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchSongs]);

  useEffect(() => {
    if (currentIndex >= songs.length && songs.length > 0) setCurrentIndex(0);
  }, [songs, currentIndex]);

  const currentSong = songs[currentIndex];

  const handleEnd = () => {
    if (songs.length > 0) setCurrentIndex((prev) => (prev + 1) % songs.length);
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
    setSongs(reordered);
    await Promise.all(reordered.map((song, i) => supabase.from("songs").update({ order: i }).eq("id", song.id)));
  };

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-white overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Player area */}
        <div className="flex-1 flex flex-col bg-gradient-to-b from-[#1a1a2e]/50 to-[#0a0a0a]">
          {/* Header */}
          <div className="px-8 pt-6 pb-2 flex items-center gap-3">
            <div className="w-9 h-9 bg-[#1db954] rounded-xl flex items-center justify-center shadow-lg shadow-[#1db954]/20">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                <path d="M3 1.713a.7.7 0 011.05-.607l10.89 6.288a.7.7 0 010 1.212L4.05 14.894A.7.7 0 013 14.288V1.713z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-tight">Mjuza Do Suza(2)</h1>
              <p className="text-[11px] text-white/30">Shared jukebox</p>
            </div>
          </div>

          {/* Video - takes up most of the space */}
          <div className="flex-1 flex items-center justify-center p-6">
            {currentSong ? (
              <div className="w-full h-full max-h-[75vh] bg-black rounded-2xl overflow-hidden shadow-2xl shadow-black/80 ring-1 ring-white/[0.06]">
                <YouTube
                  key={currentSong.youtube_id}
                  videoId={currentSong.youtube_id}
                  opts={{
                    width: "100%",
                    height: "100%",
                    playerVars: { autoplay: 1, controls: 1 },
                  }}
                  onEnd={handleEnd}
                  onReady={(e: YouTubeEvent) => { playerRef.current = e.target; }}
                  className="w-full h-full"
                  iframeClassName="w-full h-full"
                />
              </div>
            ) : (
              <div className="w-full h-full max-h-[75vh] bg-[#111]/80 rounded-2xl flex flex-col items-center justify-center gap-5 ring-1 ring-white/[0.04]">
                <div className="w-20 h-20 rounded-full bg-white/[0.03] flex items-center justify-center">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1" opacity="0.2">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-white/30 text-base font-medium">Nema pjesama u redu</p>
                  <p className="text-white/15 text-sm mt-1">Otvori /user na mobitelu i dodaj</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar playlist */}
        <div className="w-[380px] bg-[#111] flex flex-col border-l border-white/[0.04]">
          <div className="px-5 pt-6 pb-4 flex items-center justify-between">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.15em] text-white/40">
              Red pustanja
            </h2>
            <span className="text-[11px] text-white/20 bg-white/[0.05] px-2.5 py-1 rounded-full font-medium">
              {songs.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={songs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {songs.map((song, i) => (
                  <SortableItem
                    key={song.id}
                    song={song}
                    isPlaying={i === currentIndex}
                    index={i}
                    onRemove={handleRemove}
                    onPlay={setCurrentIndex}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {songs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-white/15">
                <p className="text-sm">Prazna lista</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Now playing bar */}
      {currentSong && (
        <div className="h-[72px] bg-gradient-to-r from-[#181818] via-[#1a1a1a] to-[#181818] border-t border-white/[0.04] flex items-center px-6 gap-5">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {currentSong.thumbnail && (
              <img src={currentSong.thumbnail} alt="" className="w-12 h-12 rounded-lg shadow-lg ring-1 ring-white/[0.06]" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{currentSong.title}</p>
              <p className="text-[11px] text-white/30 mt-0.5">Svira</p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <button
              onClick={() => setCurrentIndex((prev) => (prev - 1 + songs.length) % songs.length)}
              className="text-white/30 hover:text-white transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.3 1a.7.7 0 01.7.7v5.15l9.95-5.744a.7.7 0 011.05.606v12.575a.7.7 0 01-1.05.607L4 9.15v5.15a.7.7 0 01-1.4 0V1.7a.7.7 0 01.7-.7z" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentIndex((prev) => (prev + 1) % songs.length)}
              className="text-white/30 hover:text-white transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                <path d="M12.7 1a.7.7 0 00-.7.7v5.15L2.05 1.107A.7.7 0 001 1.712v12.575a.7.7 0 001.05.607L12 9.15v5.15a.7.7 0 001.4 0V1.7a.7.7 0 00-.7-.7z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
