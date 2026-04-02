import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query) {
    return NextResponse.json({ items: [] });
  }

  // Use YouTube's internal search endpoint (no API key needed)
  const res = await fetch(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%3D%3D`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    }
  );

  const html = await res.text();

  // Extract ytInitialData JSON from the page
  const match = html.match(/var ytInitialData = ({.*?});<\/script>/s);
  if (!match) {
    return NextResponse.json({ items: [] });
  }

  try {
    const data = JSON.parse(match[1]);
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents ||
      [];

    const items = contents
      .filter((item: any) => item.videoRenderer)
      .slice(0, 10)
      .map((item: any) => {
        const v = item.videoRenderer;
        return {
          videoId: v.videoId,
          title: v.title?.runs?.[0]?.text || "",
          thumbnail:
            v.thumbnail?.thumbnails?.pop()?.url || "",
        };
      });

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
