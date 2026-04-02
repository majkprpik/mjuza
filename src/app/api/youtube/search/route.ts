import { NextRequest, NextResponse } from "next/server";
import YouTube from "youtube-sr";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query) {
    return NextResponse.json({ items: [] });
  }

  try {
    const results = await YouTube.search(query, { limit: 10, type: "video" });

    const items = results.map((video) => ({
      videoId: video.id,
      title: video.title || "",
      thumbnail: video.thumbnail?.url || "",
    }));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
