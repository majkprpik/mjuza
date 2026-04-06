import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createRoomCode } from "@/lib/room-code";

export async function POST(req: NextRequest) {
  const { name, guestId, ownerId } = await req.json();

  let attempts = 0;
  while (attempts < 5) {
    const code = createRoomCode();
    const { error } = await supabase.from("rooms").insert({
      code,
      name: name || "Nova Soba",
      created_by_guest_id: guestId || null,
      owner_id: ownerId || null,
    });
    if (!error) {
      return NextResponse.json({ code, name: name || "Nova Soba" });
    }
    attempts++;
  }

  return NextResponse.json(
    { error: "Failed to create room" },
    { status: 500 }
  );
}
