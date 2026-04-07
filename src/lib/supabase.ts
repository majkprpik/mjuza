import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
);

export type Song = {
  id: string;
  youtube_id: string;
  title: string;
  thumbnail: string | null;
  order: number;
  created_at: string;
  room_id: string;
  added_by_guest_id: string | null;
  added_by_name: string | null;
};

export type Room = {
  id: string;
  code: string;
  name: string;
  created_at: string;
  archived_at: string | null;
  created_by_guest_id: string | null;
  now_playing_song_id: string | null;
  owner_id: string | null;
};

export type RoomMember = {
  id: string;
  room_id: string;
  guest_id: string;
  display_name: string;
  last_seen_at: string;
  created_at: string;
  user_id: string | null;
};

export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  created_at: string;
};

export type Friendship = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
};

export type SongCatalogRow = {
  id: string;
  video_id: string;
  title: string;
  thumbnail: string;
  spotify_artist: string | null;
  spotify_track_name: string | null;
  spotify_album_art: string | null;
  is_dead: boolean;
  created_at: string;
};
