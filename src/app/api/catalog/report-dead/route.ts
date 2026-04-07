import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { videoId } = await req.json();
  if (!videoId) {
    return NextResponse.json({ error: "Missing videoId" }, { status: 400 });
  }

  await supabase
    .from("song_catalog")
    .update({ is_dead: true })
    .eq("video_id", videoId);

  return NextResponse.json({ ok: true });
}
