import { NextRequest, NextResponse } from "next/server";
import yts from "yt-search";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;

let spotifyToken: string | null = null;
let tokenExpiry = 0;

async function getSpotifyToken() {
  if (spotifyToken && Date.now() < tokenExpiry) return spotifyToken;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET).toString(
          "base64"
        ),
    },
    body: "grant_type=client_credentials",
  });

  const data = await res.json();
  spotifyToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return spotifyToken;
}

type SpotifyTrack = {
  name: string;
  artists: { name: string }[];
  album: {
    images: { url: string }[];
  };
};

async function searchYouTube(query: string, limit: number) {
  const result = await yts(query);
  return result.videos.slice(0, limit).map((v) => ({
    videoId: v.videoId,
    title: v.title,
    thumbnail: v.thumbnail || "",
  }));
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query) {
    return NextResponse.json({ items: [] });
  }

  try {
    const token = await getSpotifyToken();

    // Run Spotify search and YouTube search in parallel
    const [spotifyRes, ytDirectResults] = await Promise.all([
      fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`,
        { headers: { Authorization: `Bearer ${token}` } }
      ),
      searchYouTube(query, 5),
    ]);

    const spotifyData = await spotifyRes.json();
    const tracks: SpotifyTrack[] = spotifyData.tracks?.items || [];

    // Get YouTube videos for Spotify tracks
    const spotifyItems =
      tracks.length > 0
        ? (
            await Promise.all(
              tracks.map(async (track) => {
                const artist = track.artists[0]?.name || "";
                const ytQuery = `${artist} - ${track.name}`;

                try {
                  const results = await searchYouTube(ytQuery, 1);
                  const video = results[0];
                  if (!video) return null;

                  return {
                    videoId: video.videoId,
                    title: `${artist} - ${track.name}`,
                    thumbnail:
                      track.album.images[1]?.url ||
                      track.album.images[0]?.url ||
                      video.thumbnail ||
                      "",
                    spotifyMeta: {
                      artist,
                      trackName: track.name,
                      albumArt:
                        track.album.images[0]?.url ||
                        track.album.images[1]?.url ||
                        "",
                    },
                  };
                } catch {
                  return null;
                }
              })
            )
          ).filter(Boolean)
        : [];

    // Merge: Spotify results first, then YouTube results (deduplicated)
    const seenIds = new Set(spotifyItems.map((item) => item!.videoId));
    const uniqueYtItems = ytDirectResults.filter(
      (item) => !seenIds.has(item.videoId)
    );
    const items = [...spotifyItems, ...uniqueYtItems].slice(0, 10);

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
