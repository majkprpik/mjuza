import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type Song = {
  id: string;
  youtube_id: string;
  title: string;
  thumbnail: string | null;
  order: number;
  created_at: string;
};
