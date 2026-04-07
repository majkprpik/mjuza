import { NextRequest, NextResponse } from "next/server";
import yts from "yt-search";
import { supabase } from "@/lib/supabase";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

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

  const normalized = normalizeQuery(query);

  try {
    // Step 1: Check catalog first
    const { data: catalogResults } = await supabase
      .from("song_catalog")
      .select("*")
      .eq("is_dead", false)
      .or(`title.ilike.%${normalized}%,spotify_artist.ilike.%${normalized}%`)
      .limit(10);

    const catalogItems = (catalogResults || []).map((row) => ({
      videoId: row.video_id,
      title: row.title,
      thumbnail: row.thumbnail,
      ...(row.spotify_artist
        ? {
            spotifyMeta: {
              artist: row.spotify_artist,
              trackName: row.spotify_track_name || "",
              albumArt: row.spotify_album_art || "",
            },
          }
        : {}),
    }));

    // If catalog has enough results, return immediately
    if (catalogItems.length >= 10) {
      return NextResponse.json({ items: catalogItems.slice(0, 10) });
    }

    // Step 2: Fill remaining slots from APIs
    const remaining = 10 - catalogItems.length;
    const seenIds = new Set(catalogItems.map((item) => item.videoId));

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

    // Merge API results, excluding what's already in catalog
    const apiSeenIds = new Set(spotifyItems.map((item) => item!.videoId));
    const uniqueYtItems = ytDirectResults.filter(
      (item) => !apiSeenIds.has(item.videoId) && !seenIds.has(item.videoId)
    );
    const newApiItems = [...spotifyItems, ...uniqueYtItems]
      .filter((item) => !seenIds.has(item!.videoId))
      .slice(0, remaining);

    // Step 3: Save new results to catalog (fire-and-forget)
    if (newApiItems.length > 0) {
      const catalogRows = newApiItems.map((item) => ({
        video_id: item!.videoId,
        title: item!.title,
        thumbnail: item!.thumbnail || "",
        spotify_artist: (item as any)?.spotifyMeta?.artist || null,
        spotify_track_name: (item as any)?.spotifyMeta?.trackName || null,
        spotify_album_art: (item as any)?.spotifyMeta?.albumArt || null,
      }));

      supabase
        .from("song_catalog")
        .upsert(catalogRows, { onConflict: "video_id" })
        .then(() => {});
    }

    const items = [...catalogItems, ...newApiItems].slice(0, 10);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
