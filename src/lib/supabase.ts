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
};
