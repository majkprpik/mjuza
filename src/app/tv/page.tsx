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
      className={`group flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-all duration-150 ${
        isPlaying
          ? "bg-white/10"
          : "hover:bg-white/[0.06]"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="cursor-grab active:cursor-grabbing text-[#6a6a6a] hover:text-[#b3b3b3] text-xs w-5 flex-shrink-0"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
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
          <div className="flex items-end justify-center gap-[2px] h-3">
            <span className="w-[3px] bg-[#1db954] rounded-full animate-pulse" style={{ height: "8px", animationDelay: "0ms" }} />
            <span className="w-[3px] bg-[#1db954] rounded-full animate-pulse" style={{ height: "12px", animationDelay: "150ms" }} />
            <span className="w-[3px] bg-[#1db954] rounded-full animate-pulse" style={{ height: "6px", animationDelay: "300ms" }} />
          </div>
        ) : (
          <span className="text-[#6a6a6a] text-xs group-hover:hidden">{index + 1}</span>
        )}
        {!isPlaying && (
          <svg className="hidden group-hover:block w-3 h-3 mx-auto text-white fill-current" viewBox="0 0 16 16">
            <path d="M3 1.713a.7.7 0 011.05-.607l10.89 6.288a.7.7 0 010 1.212L4.05 14.894A.7.7 0 013 14.288V1.713z" />
          </svg>
        )}
      </div>

      {song.thumbnail && (
        <img
          src={song.thumbnail}
          alt=""
          className="w-10 h-10 rounded object-cover flex-shrink-0"
        />
      )}

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isPlaying ? "text-[#1db954]" : "text-white"}`}>
          {song.title}
        </p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(song.id);
        }}
        className="opacity-0 group-hover:opacity-100 text-[#6a6a6a] hover:text-white transition-opacity p-1"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2.5 4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zM5 2a1 1 0 011-1h4a1 1 0 011 1v1H5V2zm-1.5 4a.5.5 0 01.5.5v6a1 1 0 001 1h6a1 1 0 001-1v-6a.5.5 0 011 0v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a.5.5 0 01.5-.5z" />
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
    <div className="h-screen flex flex-col bg-black text-white overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Player area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="px-8 pt-6 pb-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-[#1db954] rounded-full flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                <path d="M3 1.713a.7.7 0 011.05-.607l10.89 6.288a.7.7 0 010 1.212L4.05 14.894A.7.7 0 013 14.288V1.713z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight">Mjuza Do Suza(2)</h1>
          </div>

          {/* Video */}
          <div className="flex-1 flex items-center justify-center px-8 pb-4">
            {currentSong ? (
              <div className="w-full max-w-4xl aspect-video bg-[#121212] rounded-lg overflow-hidden shadow-2xl shadow-black/50">
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
              <div className="w-full max-w-4xl aspect-video bg-[#121212] rounded-lg flex flex-col items-center justify-center gap-4">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#6a6a6a" strokeWidth="1.5">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
                <p className="text-[#6a6a6a] text-lg">Dodaj pjesme na /user</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar playlist */}
        <div className="w-96 bg-[#121212] border-l border-white/[0.06] flex flex-col">
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-[#b3b3b3]">
                Red pustanja
              </h2>
              <span className="text-xs text-[#6a6a6a] font-medium">{songs.length} pjesama</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2">
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
              <div className="flex flex-col items-center justify-center h-40 text-[#6a6a6a]">
                <p className="text-sm">Prazna lista</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Now playing bar */}
      {currentSong && (
        <div className="h-20 bg-[#181818] border-t border-white/[0.06] flex items-center px-6 gap-4">
          {currentSong.thumbnail && (
            <img src={currentSong.thumbnail} alt="" className="w-14 h-14 rounded shadow-lg" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{currentSong.title}</p>
            <p className="text-xs text-[#6a6a6a]">Svira trenutno</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentIndex((prev) => (prev - 1 + songs.length) % songs.length)}
              className="text-[#b3b3b3] hover:text-white transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.3 1a.7.7 0 01.7.7v5.15l9.95-5.744a.7.7 0 011.05.606v12.575a.7.7 0 01-1.05.607L4 9.15v5.15a.7.7 0 01-1.4 0V1.7a.7.7 0 01.7-.7z" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentIndex((prev) => (prev + 1) % songs.length)}
              className="text-[#b3b3b3] hover:text-white transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M12.7 1a.7.7 0 00-.7.7v5.15L2.05 1.107A.7.7 0 001 1.712v12.575a.7.7 0 001.05.607L12 9.15v5.15a.7.7 0 001.4 0V1.7a.7.7 0 00-.7-.7z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
