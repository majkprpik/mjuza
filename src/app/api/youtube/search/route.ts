import { NextRequest, NextResponse } from "next/server";
import yts from "yt-search";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query) {
    return NextResponse.json({ items: [] });
  }

  try {
    const result = await yts(query);

    const items = result.videos.slice(0, 10).map((video) => ({
      videoId: video.videoId,
      title: video.title || "",
      thumbnail: video.thumbnail || "",
    }));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
