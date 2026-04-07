import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET: fetch friends + pending requests for a user
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ friends: [], pending: [] });

  // Accepted friendships (both directions)
  const { data: friendships } = await supabase
    .from("friendships")
    .select("*, sender:profiles!sender_id(*), receiver:profiles!receiver_id(*)")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .eq("status", "accepted");

  // Pending requests received
  const { data: pending } = await supabase
    .from("friendships")
    .select("*, sender:profiles!sender_id(*)")
    .eq("receiver_id", userId)
    .eq("status", "pending");

  // Pending requests sent
  const { data: sent } = await supabase
    .from("friendships")
    .select("*, receiver:profiles!receiver_id(*)")
    .eq("sender_id", userId)
    .eq("status", "pending");

  return NextResponse.json({
    friends: friendships || [],
    pending: pending || [],
    sent: sent || [],
  });
}

// POST: send friend request or search for user
export async function POST(req: NextRequest) {
  const { action, senderId, query, receiverId } = await req.json();

  if (action === "search") {
    // Search by username or email
    const trimmed = (query || "").trim().toLowerCase();
    if (!trimmed) return NextResponse.json({ results: [] });

    // Search profiles by username or email
    const { data: results } = await supabase
      .from("profiles")
      .select("id, username, display_name, email")
      .or(`username.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
      .neq("id", senderId)
      .limit(5);

    return NextResponse.json({ results: results || [] });
  }

  if (action === "send") {
    if (!senderId || !receiverId) {
      return NextResponse.json({ error: "Missing IDs" }, { status: 400 });
    }
    // Check if friendship already exists in either direction
    const { data: existing } = await supabase
      .from("friendships")
      .select("id, status")
      .or(
        `and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`
      );

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: "Vec postoji zahtjev", existing: existing[0] });
    }

    const { error } = await supabase.from("friendships").insert({
      sender_id: senderId,
      receiver_id: receiverId,
      status: "pending",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
