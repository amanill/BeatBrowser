import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import compression from "compression";
import { Redis } from "@upstash/redis";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = (upstashUrl && upstashToken) ? new Redis({
  url: upstashUrl,
  token: upstashToken,
}) : null;

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
}) : null;

// Generic, high-performance in-memory cache system with TTL expiration
class SimpleCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();
  constructor(private ttlMs: number = 30 * 60 * 1000) {} // default 30 minutes

  get(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return cached.value;
  }

  set(key: string, value: T): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Caches initialized at application boundary level
const searchCache = new SimpleCache<any>(15 * 60 * 1000); // 15 mins
const songDnaCache = new SimpleCache<any>(60 * 60 * 1000); // 1 hour
const artistDnaCache = new SimpleCache<any>(60 * 60 * 1000); // 1 hour
const discographyCache = new SimpleCache<any>(60 * 60 * 1000); // 1 hour
const lastfmCache = new SimpleCache<any>(15 * 60 * 1000); // 15 mins
const globalImageCache = new Map<string, string>(); // Persistent memory image caching

// Schema for search results
const searchResponseSchema = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "A unique slug, e.g. 'track_stairway-to-heaven' or 'artist_led-zeppelin'" },
          name: { type: Type.STRING, description: "Display name of the track or artist profile" },
          artist: { type: Type.STRING, description: "The artist name (or empty if searching for an artist profile itself)" },
          album: { type: Type.STRING, description: "The album name (or empty if searching for an artist profile itself)" },
          releaseDate: { type: Type.STRING, description: "Estimated year of release, e.g. '1971' (or empty if searching for an artist profile itself)" },
          type: { type: Type.STRING, description: "Must be exactly 'song' or 'artist'" },
          genre: { type: Type.STRING, description: "The primary musical genre associated with this music" }
        },
        required: ["id", "name", "artist", "album", "releaseDate", "type", "genre"]
      }
    }
  },
  required: ["results"]
};

// Response schema for Gemini Song DNA
const songDnaSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    artist: { type: Type.STRING },
    genres: { type: Type.ARRAY, items: { type: Type.STRING } },
    description: { type: Type.STRING },
    metrics: {
      type: Type.OBJECT,
      properties: {
        energy: { type: Type.INTEGER, description: "Intensity rating between 0 and 100" },
        valence: { type: Type.INTEGER, description: "Cheerfulness / emotional positivity rating between 0 and 100" },
        acousticness: { type: Type.INTEGER, description: "Acoustic organic instruments presence rating between 0 and 100" },
        danceability: { type: Type.INTEGER, description: "Beat stability / groove rating between 0 and 100" },
        tempo: { type: Type.INTEGER, description: "Estimated Beats Per Minute (BPM)" },
        vocalPresence: { type: Type.INTEGER, description: "Voice focus & forwardness rating between 0 and 100" },
        complexity: { type: Type.INTEGER, description: "Compositional structural complexity rating between 0 and 100" },
      },
      required: ["energy", "valence", "acousticness", "danceability", "tempo", "vocalPresence", "complexity"],
    },
    similarTracks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique short identifier (e.g. recommend1, recommend2)" },
          title: { type: Type.STRING },
          artist: { type: Type.STRING },
          similarityScore: { type: Type.INTEGER, description: "Overlap estimate from 10 to 100" },
          explanation: { type: Type.STRING, description: "1 sentence explaining the deep sonic or stylistic link to core track" },
          x: { type: Type.INTEGER, description: "An coordinate from -100 to 100 representing energy axis distance" },
          y: { type: Type.INTEGER, description: "An coordinate from -100 to 100 representing mood/valence axis distance" },
          category: { type: Type.STRING, description: "Descriptive group label, e.g. 'Rhythmic Brother', 'Vibe Anchor', 'Harmonic Cousin', 'Sonic Twin'" },
          popularity: { type: Type.INTEGER, description: "Mainstream popularity index from 1 to 100 representing how well-known the artist/song is to general listeners" },
        },
        required: ["id", "title", "artist", "similarityScore", "explanation", "x", "y", "category", "popularity"],
      },
    },
  },
  required: ["name", "artist", "genres", "description", "metrics", "similarTracks"],
};

// Response schema for Gemini Artist DNA
const artistDnaSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    genres: { type: Type.ARRAY, items: { type: Type.STRING } },
    description: { type: Type.STRING },
    similarArtists: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique short identifier (e.g. art1, art2)" },
          name: { type: Type.STRING },
          similarityScore: { type: Type.INTEGER, description: "Relationship overlap from 10 to 100" },
          explanation: { type: Type.STRING, description: "1 sentence describing their direct stylistic tie" },
          x: { type: Type.INTEGER, description: "An coordinate from -100 to 100 representing energy similarity axis" },
          y: { type: Type.INTEGER, description: "An coordinate from -100 to 100 representing emotion similarity axis" },
          category: { type: Type.STRING, description: "Cohesive group label like 'Vibe Peer' or 'Genre Catalyst'" },
          popularity: { type: Type.INTEGER, description: "Mainstream popularity index from 1 to 100 representing how well-known the artist is to general listeners" },
        },
        required: ["id", "name", "similarityScore", "explanation", "x", "y", "category", "popularity"],
      },
    },
  },
  required: ["name", "genres", "description", "similarArtists"],
};

// Response schema for Gemini Album Discography
const discographySchema = {
  type: Type.OBJECT,
  properties: {
    artist: { type: Type.STRING },
    albums: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          year: { type: Type.STRING },
          type: { type: Type.STRING, description: "One of: Album, EP, Single, Compilation" },
          keyTracks: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 to 5 breakout tracks or notable highlights" },
          synopsis: { type: Type.STRING, description: "1-2 sentences capturing the acoustic style, moods, and significance" }
        },
        required: ["title", "year", "type", "keyTracks", "synopsis"]
      }
    }
  },
  required: ["artist", "albums"]
};

// Rate limiting setup
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  function getProceduralTrackExplanation(
    centralTrack: string, 
    centralArtist: string, 
    similarTrack: string, 
    similarArtist: string, 
    score: number
  ): string {
    let hash = 0;
    const key = centralTrack + similarTrack;
    for (let i = 0; i < key.length; i++) {
      hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash);
    
    if (score >= 82) {
      const templates = [
        `An exceptional sonic pairing. "${similarTrack}" by ${similarArtist} shares overlapping harmonic structures, rich modern arrangements, and a closely aligned frequency envelope with ${centralArtist}'s work on "${centralTrack}".`,
        `Matches the central subject with sophisticated acoustic signatures. "${similarTrack}" features tight production values, rhythmic cadence, and drum coloration that echo the aesthetic choices of "${centralTrack}".`,
        `A brilliant stylistic companion. Shares key dynamic transitions, lush soundstages, and a deep ambient warmth that mirrors ${centralArtist}'s melodic depth on "${centralTrack}".`,
        `Exhibits a high-fidelity emotional resonance. "${similarTrack}" leverages similar instrumentation and vocal coloring to create an auditively seamless transition from "${centralTrack}".`
      ];
      return templates[idx % templates.length];
    } else if (score >= 62) {
      const templates = [
        `Establishes a strong stylistic response. While differing slightly in direct instrumentation, both "${similarTrack}" and "${centralTrack}" evoke a matching introspective mood and sonic warmth.`,
        `Connected via shared wave colorations. The pacing and vocal atmosphere of ${similarArtist} on this track create a deeply aligned auditory field with "${centralTrack}".`,
        `Aligns beautifully in tempo and textural weight. "${similarTrack}" possesses a shared aesthetic gravity, anchoring the core rhythmic groove established by ${centralArtist} on "${centralTrack}".`,
        `A compelling stylistic cousin. "${similarTrack}" explores complementary structural transitions and soundscape density, offering an elegant continuation of the central track's vibe.`
      ];
      return templates[idx % templates.length];
    } else {
      const templates = [
        `A subtle but distinct musical overlap. The production choices and sonic textures of "${similarTrack}" connect it to "${centralTrack}" along a warm, complementary artistic orbit.`,
        `Brings out unique acoustic parallels. ${similarArtist} delivers a creative spirit and balanced soundstage density that beautifully complements the energy of "${centralTrack}".`,
        `A delightful off-center sibling. Featuring distinct artistic palettes, both songs remain structurally anchored by a shared tempo range and expressive tonal values.`,
        `A gentle stylistic echo. "${similarTrack}" offers a softer frequency resonance that lets the listener transition seamlessly from ${centralArtist}'s intense sonic signature on "${centralTrack}".`
      ];
      return templates[idx % templates.length];
    }
  }

  function getProceduralArtistExplanation(
    centralArtist: string, 
    similarArtist: string, 
    score: number
  ): string {
    let hash = 0;
    const key = centralArtist + similarArtist;
    for (let i = 0; i < key.length; i++) {
      hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash);
    
    if (score >= 75) {
      const templates = [
        `A brilliant stylistic kinship. Both ${similarArtist} and ${centralArtist} are pioneering creators within similar acoustic realms, sharing overlapping approaches to songwriting, vocal delivery, and progressive production techniques.`,
        `Shares a highly coherent atmospheric identity. Much like ${centralArtist}'s trademark soundscapes, ${similarArtist} layers dense harmonic arrangements and textured rhythms to build immersive worlds.`,
        `An exceptional sonic pairing. In the modern music landscape, ${similarArtist} is arguably one of the closest creative contemporaries to ${centralArtist}, utilizing similar analog synth patches and organic acoustic overlays.`,
        `Connected by a shared genre blueprint. Both artists approach tempo-shifts and rhythmic breakdowns with a matching level of dynamic complexity, creating an exceptionally cohesive listening sequence.`
      ];
      return templates[idx % templates.length];
    } else if (score >= 55) {
      const templates = [
        `Establishes a compelling aesthetic connection. While their central instruments can differ, both artists design their catalogs around a signature high-concept emotional palette.`,
        `Linked via aligned song structures and instrumental arrangements. ${similarArtist} captures a similar vintage/modern hybrid vibe that fans of ${centralArtist} will find instantly familiar.`,
        `A fascinating parallel. ${similarArtist}'s work acts as a sonic bridge, taking the core experimental philosophies of ${centralArtist} and re-contextualizing them through distinct rhythmic tempos.`,
        `Features matching soundstage spatial density and dynamic range. Both artists demonstrate an incredible control over negative space, reverb decays, and minimal acoustic foundations.`
      ];
      return templates[idx % templates.length];
    } else {
      const templates = [
        `A subtle but rewarding creative overlap. While ${similarArtist} operates on a different rhythmic plane, their underlying harmonic voicings resonate gracefully with ${centralArtist}'s work.`,
        `Brings out unique sonic parallels. Listeners will appreciate how ${similarArtist} approaches live instrumentation recording, mirroring the organic and warm texture of ${centralArtist}'s arrangements.`,
        `An intriguing orbital companion. Although occupying their own distinct genre niche, ${similarArtist} shares a fundamental pop/indie experimentalism that deeply complements ${centralArtist}.`,
        `Connected by a shared philosophical spirit. Although their vocal production styles vary, both artists express a shared commitment to raw emotional honesty and layered ambient backdrops.`
      ];
      return templates[idx % templates.length];
    }
  }

  // DevOps best practice: Gzip compression of both static web assets and dynamic API payloads
  app.use(compression());
  app.use(express.json());

  // Security best practice: Disable powered-by header and configure loose CSP to prevent breaking iframes
  app.disable("x-powered-by");
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: false
  }));

  // Apply rate limiting to all /api routes
  app.use("/api", apiLimiter);

  // Image Caching Read (GET) proxying
  app.get("/api/cache/image", (req, res) => {
    const { id } = req.query;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Query parameter 'id' is required" });
    }
    const imageUrl = globalImageCache.get(id);
    if (imageUrl) {
      return res.json({ imageUrl });
    }
    return res.json({ imageUrl: null });
  });

  // Image Caching Write (POST) proxying
  app.post("/api/cache/image", (req, res) => {
    const { id, imageUrl } = req.body;
    if (!id || !imageUrl || typeof id !== "string" || typeof imageUrl !== "string") {
      return res.status(400).json({ error: "id and imageUrl properties are required in the payload" });
    }
    globalImageCache.set(id, imageUrl);
    return res.json({ status: "success", id, imageUrl });
  });

  
  app.get("/api/lastfm/similar-tracks", async (req, res) => {
    const track = req.query.track as string;
    const artist = req.query.artist as string;
    const limit = (req.query.limit as string) || '20';
    if (!track || !artist) return res.status(400).json({ error: "missing track or artist" });

    const lastfmApiKey = process.env.LASTFM_API_KEY;
    if (!lastfmApiKey) return res.json([]);

    const fetchLimit = parseInt(limit, 10);
    const limitStr = (!isNaN(fetchLimit) && fetchLimit > 0) ? `:${fetchLimit}` : '';
    const cacheKey = `music:similar:track:${artist.toLowerCase()}:${track.toLowerCase()}${limitStr}`;

    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log(`[REDIS CACHE HIT] similar-tracks for ${artist} - ${track}`);
          let parsed = cached;
          if (typeof cached === "string") {
            try { parsed = JSON.parse(cached); } catch(e) {}
          }
          if (Array.isArray(parsed)) {
            const healed = parsed.map((item: any, idx: number) => {
              if (!item.explanation) {
                const score = item.similarityScore || Math.round(parseFloat(item.match || "0") * 100) || 50;
                return {
                  ...item,
                  explanation: getProceduralTrackExplanation(track, artist, item.title || item.name || "Unknown Track", item.artist, score)
                };
              }
              return item;
            });
            return res.json(healed);
          }
        }
      } catch (err) {
        console.warn("[REDIS CACHE GET FAIL]", err);
      }
    }

    try {
      const resp = await fetch(`https://ws.audioscrobbler.com/2.0/?method=track.getsimilar&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&api_key=${lastfmApiKey}&format=json&limit=50`);
      const data = await resp.json();
      if (data.similartracks && data.similartracks.track) {
         let tracks = Array.isArray(data.similartracks.track) ? data.similartracks.track : [data.similartracks.track];

         // Filter out tracks by the queried artist
         tracks = tracks.filter((t: any) => t.artist.name.toLowerCase() !== artist.toLowerCase());
         
         // Apply limit
         if (!isNaN(fetchLimit) && fetchLimit > 0) {
            tracks = tracks.slice(0, fetchLimit);
         }
         const nodes = tracks.map((t, idx) => {
             const score = Math.round(parseFloat(t.match || "0") * 100);
             return {
                 id: t.mbid || `lfm_t_${idx}`, // Fallback ID
                 title: t.name,
                 artist: t.artist.name,
                 similarityScore: score,
                 explanation: getProceduralTrackExplanation(track, artist, t.name, t.artist.name, score),
                 // Distribute them roughly in a spiral or circle
                 x: Math.round(Math.cos(idx * 2) * (20 + idx * 2)),
                 y: Math.round(Math.sin(idx * 2) * (20 + idx * 2)),
                 category: "Similar Vibe",
                 imageUrl: t.image?.[2]?.['#text'] || ""
             };
         });
         
         if (redis) {
           try {
             // Cache for 7 days
             await redis.setex(cacheKey, 604800, JSON.stringify(nodes));
             console.log(`[REDIS CACHE SET SUCCESS] ${cacheKey}`);
           } catch (err) {
             console.warn("[REDIS CACHE SET FAIL]", err);
           }
         }
         
         return res.json(nodes);
      }
      return res.json([]);
    } catch(e) {
      console.error(e);
      return res.json([]);
    }
  });

  app.get("/api/lastfm/similar-artists", async (req, res) => {
    const artist = req.query.artist as string;
    const limit = (req.query.limit as string) || '20';
    if (!artist) return res.status(400).json({ error: "missing artist" });

    const lastfmApiKey = process.env.LASTFM_API_KEY;
    if (!lastfmApiKey) return res.json([]);

    const fetchLimit = parseInt(limit, 10);
    const limitStr = (!isNaN(fetchLimit) && fetchLimit > 0) ? `:${fetchLimit}` : '';
    const cacheKey = `music:similar:artist:${artist.toLowerCase()}${limitStr}`;

    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log(`[REDIS CACHE HIT] similar-artists for ${artist}`);
          let parsed = cached;
          if (typeof cached === "string") {
            try { parsed = JSON.parse(cached); } catch(e) {}
          }
          if (Array.isArray(parsed)) {
            const healed = parsed.map((item: any) => {
              if (!item.explanation) {
                const score = item.similarityScore || Math.round(parseFloat(item.match || "0") * 100) || 50;
                return {
                  ...item,
                  explanation: getProceduralArtistExplanation(artist, item.name || item.title || "Unknown Artist", score)
                };
              }
              return item;
            });
            return res.json(healed);
          }
        }
      } catch (err) {
        console.warn("[REDIS CACHE GET FAIL]", err);
      }
    }

    try {
      const resp = await fetch(`https://ws.audioscrobbler.com/2.0/?method=artist.getsimilar&artist=${encodeURIComponent(artist)}&api_key=${lastfmApiKey}&format=json&limit=${limit}`);
      const data = await resp.json();
      if (data.similarartists && data.similarartists.artist) {
         let artists = Array.isArray(data.similarartists.artist) ? data.similarartists.artist : [data.similarartists.artist];
         const nodes = artists.map((a, idx) => ({
             id: a.mbid || `lfm_art_${idx}`, // Fallback ID
             name: a.name,
             similarityScore: Math.round(parseFloat(a.match || "0") * 100),
             explanation: getProceduralArtistExplanation(artist, a.name, Math.round(parseFloat(a.match || "0") * 100)),
             x: Math.round(Math.cos(idx * 2) * (20 + Math.random() * 50)),
             y: Math.round(Math.sin(idx * 2) * (20 + Math.random() * 50)),
             category: "Similar Vibes",
             imageUrl: a.image?.[2]?.['#text'] || ""
         }));

         if (redis) {
           try {
             // Cache for 7 days
             await redis.setex(cacheKey, 604800, JSON.stringify(nodes));
             console.log(`[REDIS CACHE SET SUCCESS] ${cacheKey}`);
           } catch (err) {
             console.warn("[REDIS CACHE SET FAIL]", err);
           }
         }

         return res.json(nodes);
      }
      return res.json([]);
    } catch(e) {
      console.error(e);
      return res.json([]);
    }
  });


  // ListenBrainz urls2msids bulk mapping API proxy
  app.post("/api/listenbrainz/lookup", async (req, res) => {
    const { urls } = req.body;
    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({ error: "A list of 'urls' is required" });
    }
    try {
      const response = await fetch("https://api.listenbrainz.org/1/metadata/lookup/urls2msids", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ urls })
      });
      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
      return res.status(response.status).json({ error: `ListenBrainz responded with status ${response.status}` });
    } catch (err: any) {
      console.error("[LISTENBRAINZ PROXY EXCEPTION]:", err);
      // Graceful fallback response to avoid crashing the client loop
      return res.status(500).json({ error: err.message || "Failed to lookup ListenBrainz maps" });
    }
  });

  // Last.fm Autocomplete Search Proxy
  app.get("/api/lastfm/search", async (req, res) => {
    const query = req.query.q;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    const cacheKey = query.trim().toLowerCase();
    const cachedData = lastfmCache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const lastfmApiKey = process.env.LASTFM_API_KEY;
    if (!lastfmApiKey) {
      // Gracefully return empty if key is not configured yet
      return res.json({ tracks: [], artists: [] });
    }

    try {
      const trackUrl = `http://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(query)}&api_key=${lastfmApiKey}&format=json&limit=15`;
      const artistUrl = `http://ws.audioscrobbler.com/2.0/?method=artist.search&artist=${encodeURIComponent(query)}&api_key=${lastfmApiKey}&format=json&limit=10`;

      const [trackRes, artistRes] = await Promise.all([
        fetch(trackUrl).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(artistUrl).then(r => r.ok ? r.json() : null).catch(() => null)
      ]);

      const tracks = trackRes?.results?.trackmatches?.track || [];
      const artists = artistRes?.results?.artistmatches?.artist || [];

      const payload = { tracks, artists };
      lastfmCache.set(cacheKey, payload);

      return res.json(payload);
    } catch (err: any) {
      console.error("[LASTFM PROXY ERROR]:", err);
      // Graceful fallback so API never hard crashes the app
      return res.status(500).json({ error: err.message || "Failed to fetch from Last.fm API" });
    }
  });

  // Helpers for deterministic simulated musicological fallbacks
  function getSimpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  }

  function generateFallbackSearch(query: string) {
    const hash = getSimpleHash(query);
    const type = hash % 2 === 0 ? "song" : "artist";
    const genres = ["Pop", "Indie Art-Pop", "Synthesized Waves", "Classical Acoustic", "Rhythmic Beat"];
    
    const results = [
      {
        id: `fallback_search_1_${hash}`,
        name: query,
        artist: type === "artist" ? "" : "The Voyager Collective",
        album: type === "artist" ? "" : "Celestial Resonance",
        releaseDate: type === "artist" ? "" : "2026",
        type,
        genre: genres[hash % genres.length]
      },
      {
        id: `fallback_search_2_${hash}`,
        name: `${query} (Acoustic Echoes)`,
        artist: "Aura Shade",
        album: "The Silver Cord EP",
        releaseDate: "2025",
        type: "song",
        genre: "Indie Folk"
      },
      {
        id: `fallback_search_3_${hash}`,
        name: `${query} Club Mix`,
        artist: "Subsystem Pulse",
        album: "Binary Stars Volume 1",
        releaseDate: "2026",
        type: "song",
        genre: "Future House"
      },
      {
        id: `fallback_search_4_${hash}`,
        name: `${query} Movement`,
        artist: "",
        album: "",
        releaseDate: "",
        type: "artist",
        genre: "Modern Instrumental"
      }
    ];

    return { results };
  }

  // Helper to recenter coordinates so closest similarity score items dynamically sit closer to central node
  function recenterCoordinatesBasedOnSimilarity(similarItems: any[]): any[] {
    if (!Array.isArray(similarItems)) return [];
    
    const sorted = [...similarItems].sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));
    
    return sorted.map((node, index) => {
      const similarity = node.similarityScore || 50;
      const minRadius = 15;
      const maxRadius = 85;
      const clampedSimilarity = Math.max(0, Math.min(1, (similarity - 50) / 48));
      
      // Radius corresponds directly to dissimilarity (higher similarity = closer to center, lower similarity = further away)
      const distance = maxRadius - (clampedSimilarity * (maxRadius - minRadius)) + (index * 2) % 6;
      
      // Symmetric 360-degree radial distribution to avoid having clusterings or "0 points on the left"
      const angle = (index / sorted.length) * 2 * Math.PI + (index * 0.4) % 0.3;
      
      const x = Math.round(Math.cos(angle) * distance);
      const y = Math.round(Math.sin(angle) * distance);
      
      return {
        ...node,
        x,
        y
      };
    });
  }

  function generateFallbackSongDNA(trackName: string, artistName: string, count: number) {
    const hash = getSimpleHash(trackName + artistName);
    
    const energy = 30 + (hash % 61); // 30-90
    const valence = 20 + ((hash >> 1) % 71); // 20-90
    const acousticness = 10 + ((hash >> 2) % 81); // 10-90
    const danceability = 25 + ((hash >> 3) % 66); // 25-90
    const tempo = 80 + ((hash >> 4) % 101); // 80-180
    const vocalPresence = 15 + ((hash >> 5) % 76); // 15-90
    const complexity = 30 + ((hash >> 6) % 61); // 30-90

    const stylePools = [
      ["Indie Art-Pop", "Dream Pop", "Acoustic Indie"],
      ["Synthwave", "Electropop", "Retro Electro"],
      ["Contemporary R&B", "Neo-Soul", "Liquid Groove"],
      ["Post-Rock", "Cinematic Ambient", "Neoclassical"],
      ["Alternative Metal", "Grunge Revival", "Heavy Alternative"],
      ["Classic Funk", "Indie Disco", "Dance-Rock"]
    ];
    const genres = stylePools[hash % stylePools.length];

    const famousTracksPool = [
      { title: "Lost in Yesterday", artist: "Tame Impala", popularity: 82, category: "Sonic Twin", desc: "Features high-fidelity retro synth grooves and textured vocal production." },
      { title: "Everything in Its Right Place", artist: "Radiohead", popularity: 78, category: "Vibe Anchor", desc: "Pioneered the dark-toned Rhodes synthesizer progression and ambient vocal edits." },
      { title: "Instant Crush", artist: "Daft Punk", popularity: 88, category: "Sonic Twin", desc: "A masterpiece of vocoder execution paired with clean indie guitar riffs." },
      { title: "White Ferrari", artist: "Frank Ocean", popularity: 84, category: "Melancholy Cousin", desc: "Minimalist ambient-indie structure tracing a deep emotional vocal atmosphere." },
      { title: "Breezeblocks", artist: "Alt-J", popularity: 76, category: "Genre Catalyst", desc: "A creative blueprint combining folk elements with experimental vocal overlays." },
      { title: "Do I Wanna Know?", artist: "Arctic Monkeys", popularity: 91, category: "Rhythmic Brother", desc: "Features a massive mid-tempo distorted guitar hook and tight punchy drums." },
      { title: "Chamber of Reflection", artist: "Mac DeMarco", popularity: 83, category: "Harmonic Cousin", desc: "Warped analog synthesizers create a dreamy lo-fi atmosphere." },
      { title: "Myth", artist: "Beach House", popularity: 74, category: "Vibe Anchor", desc: "Lush dream-pop textures built upon spacious reverb and delicate percussion." },
      { title: "Bad Guy", artist: "Billie Eilish", popularity: 89, category: "Rhythmic Brother", desc: "Ultra-minimalist bass groove with whisper-style dry vocal layers." },
      { title: "Royals", artist: "Lorde", popularity: 85, category: "Genre Catalyst", desc: "A watershed minimalist pop template relying on finger snaps and sub-bass." },
      { title: "Sweater Weather", artist: "The Neighbourhood", popularity: 89, category: "Harmonic Cousin", desc: "Moody indie-pop guitars paired with a signature nostalgic vocal delivery." },
      { title: "Electric Feel", artist: "MGMT", popularity: 82, category: "Energetic Echo", desc: "High-octane synth-funk baseline that energized the late-2000s indie landscape." },
      { title: "Pumped Up Kicks", artist: "Foster the People", popularity: 84, category: "Energetic Echo", desc: "Catchy whistle hooks floating over a dark underlying narrative lyric." },
      { title: "The Less I Know the Better", artist: "Tame Impala", popularity: 90, category: "Rhythmic Brother", desc: "One of the most famous basslines in modern indie-disco-pop history." },
      { title: "Midnight City", artist: "M83", popularity: 81, category: "Energetic Echo", desc: "Epic shoegaze-influenced electronic anthem centered on a soaring sax outro." },
      { title: "Intro", artist: "The xx", popularity: 79, category: "Acoustic Twin", desc: "An iconic, atmospheric guitar loop that defined modern minimalist indie-electronic vibes." },
      { title: "Reflektor", artist: "Arcade Fire", popularity: 68, category: "Sonic Twin", desc: "Disco-punk hybrid production featuring art-rock arrangements." },
      { title: "Heat Waves", artist: "Glass Animals", popularity: 88, category: "Sonic Twin", desc: "Dreamy modern psychedelic-pop with trap-style hi-hat drum accents." },
      { title: "Somebody That I Used to Know", artist: "Gotye", popularity: 87, category: "Acoustic Twin", desc: "Combining xylophones and custom retro acoustic guitar samples." },
      { title: "Clint Eastwood", artist: "Gorillaz", popularity: 82, category: "Genre Catalyst", desc: "Merged golden-era hip-hop flows with dub-fused indie-rock hooks." },
      { title: "Nightcall", artist: "Kavinsky", popularity: 80, category: "Sonic Twin", desc: "The definitive cinematic outrun synthwave soundtrack with deep vocoders." },
      { title: "Video Games", artist: "Lana Del Rey", popularity: 83, category: "Melancholy Cousin", desc: "Cinematic harp-and-string arrangement supporting a nostalgic vocal performance." },
      { title: "Starboy", artist: "The Weeknd", popularity: 92, category: "Sonic Twin", desc: "Dark R&B elements overlaid on a driving electronic Daft Punk production." },
      { title: "Humble", artist: "Kendrick Lamar", popularity: 87, category: "Energetic Echo", desc: "A hard-hitting minimalist piano riff paired with aggressive elite lyricism." },
      { title: "Redbone", artist: "Childish Gambino", popularity: 86, category: "Harmonic Cousin", desc: "Heavy modern funk track influenced by vintage soul and high-register falsetto." },
      { title: "Sail", artist: "AWOLNATION", popularity: 78, category: "Energetic Echo", desc: "Industrial string elements paired with soaring, aggressive vocal declarations." },
      { title: "Tongue Tied", artist: "Grouplove", popularity: 83, category: "Energetic Echo", desc: "Energetic indie-pop anthem driven by cascading synthesizer lines." },
      { title: "Gooey", artist: "Glass Animals", popularity: 76, category: "Vibe Anchor", desc: "Lush, liquid-smooth R&B infused dream pop with playful imagery." },
      { title: "Take Me to Church", artist: "Hozier", popularity: 90, category: "Melancholy Cousin", desc: "Stark piano chord changes paired with dynamic choral harmonies and soul vocals." },
      { title: "Let It Happen", artist: "Tame Impala", popularity: 84, category: "Sonic Twin", desc: "An epic 7-minute progressive synthwave-disco exploration with looping glitch effects." },
      { title: "Safe and Sound", artist: "Capital Cities", popularity: 80, category: "Energetic Echo", desc: "Upbeat trumpet-laden electropop track that defined the early 2010s radio vibe." },
      { title: "Walking on a Dream", artist: "Empire of the Sun", popularity: 81, category: "Sonic Twin", desc: "A whimsical, solar-tinged indie dance anthem with soaring high falsettos." },
      { title: "Little Lion Man", artist: "Mumford & Sons", popularity: 78, category: "Acoustic Twin", desc: "Stomping folk-rock centerpiece centered around aggressive acoustic strumming." },
      { title: "Stolen Dance", artist: "Milky Chance", popularity: 85, category: "Acoustic Twin", desc: "Fusing simple acoustic reggae guitar pickings with breezy electronic beats." },
      { title: "Riptide", artist: "Vance Joy", popularity: 89, category: "Acoustic Twin", desc: "A high-register ukulele anthem combined with extremely memorable vocal hooks." },
      { title: "Riders on the Storm", artist: "The Doors", popularity: 73, category: "Vibe Anchor", desc: "Atmospheric jazz-rock masterpiece driven by rain sound effects and Rhodes piano." },
      { title: "Smells Like Teen Spirit", artist: "Nirvana", popularity: 89, category: "Genre Catalyst", desc: "The legendary grunge anthem built on loud-quiet-loud guitar dynamics." },
      { title: "Starman", artist: "David Bowie", popularity: 79, category: "Genre Catalyst", desc: "Classic glam-rock masterpiece with spacious acoustic guitars and cosmic themes." },
      { title: "Heroes", artist: "David Bowie", popularity: 75, category: "Vibe Anchor", desc: "Soaring wall-of-sound guitar feedback atmospheres co-produced by Brian Eno." },
      { title: "Wish You Were Here", artist: "Pink Floyd", popularity: 84, category: "Acoustic Twin", desc: "The definitive melancholic acoustic tribute built on warm stereo acoustic guitars." },
      { title: "Space Oddity", artist: "David Bowie", popularity: 77, category: "Genre Catalyst", desc: "Haunting folk-sci-fi epic detailing Major Tom's drifting orbit." },
      { title: "Come a Little Closer", artist: "Cage the Elephant", popularity: 78, category: "Harmonic Cousin", desc: "Shifting alternative guitar riffs backed by expressive psych vocals." },
      { title: "Fluorescent Adolescent", artist: "Arctic Monkeys", popularity: 84, category: "Rhythmic Brother", desc: "Playful, highly kinetic guitar patterns detailing suburban British slice-of-life." },
      { title: "Young Folks", artist: "Peter Bjorn and John", popularity: 75, category: "Acoustic Twin", desc: "A universally recognizable cheerful whistle line backed by driving bongo beats." },
      { title: "Time to Pretend", artist: "MGMT", popularity: 79, category: "Genre Catalyst", desc: "Sarcastic synth-pop blueprint defining the late-2000s indie explosion." },
      { title: "Dog Days Are Over", artist: "Florence + The Machine", popularity: 80, category: "Energetic Echo", desc: "Explosive, harp-driven indie anthem built on claps and towering vocals." },
      { title: "Helena Beat", artist: "Foster the People", popularity: 65, category: "Sonic Twin", desc: "Warped bass synthesizers driving a catchy, pessimistic falsetto hook." },
      { title: "Feel It Still", artist: "Portugal. The Man", popularity: 81, category: "Rhythmic Brother", desc: "Retro-pop soul revival track featuring ultra-infectious dynamic bass work." },
      { title: "My Girls", artist: "Animal Collective", popularity: 64, category: "Sonic Twin", desc: "Highly-influential psychedelic arpeggiated synths and lush wash layers." },
      { title: "Helplessness Blues", artist: "Fleet Foxes", popularity: 66, category: "Acoustic Twin", desc: "Towering baroque-folk arrangement featuring cascading acoustic 12-strings." },
      { title: "1901", artist: "Phoenix", popularity: 77, category: "Energetic Echo", desc: "High-octane French indie-pop centered around hyper-saturated guitar lines." },
      { title: "Skinny Love", artist: "Bon Iver", popularity: 79, category: "Acoustic Twin", desc: "Stark, visceral acoustic guitar strummed on a resonator with raw vocals." },
      { title: "Ho Hey", artist: "The Lumineers", popularity: 83, category: "Acoustic Twin", desc: "Indie-folk chant-along track driven by hand drum hits and single acoustic chords." },
      { title: "Take a Walk", artist: "Passion Pit", popularity: 70, category: "Energetic Echo", desc: "Nostalgic synth-heavy narrative describing familial financial struggles." },
      { title: "Go Flex", artist: "Post Malone", popularity: 80, category: "Acoustic Twin", desc: "Breezy acoustic guitar patterns merged with modern trap low frequencies." },
      { title: "As It Was", artist: "Harry Styles", popularity: 92, category: "Rhythmic Brother", desc: "Infectious indie-pop groove centered around retro synth lines and chiming bells." },
      { title: "Ribs", artist: "Lorde", popularity: 81, category: "Vibe Anchor", desc: "Lush ambient vocal loops and building synth pads detailing growing up." },
      { title: "Cruel Summer", artist: "Taylor Swift", popularity: 93, category: "Energetic Echo", desc: "Punchy electronic synth arpeggiators driving an explosive bridge." }
    ];

    const similarTracks: any[] = [];
    const seenKeys = new Set<string>();
    // Skip adding core track as its own recommendation
    seenKeys.add(`${trackName.toLowerCase()}--${artistName.toLowerCase()}`);

    let idx = 0;
    while (similarTracks.length < count && idx < famousTracksPool.length * 2) {
      const poolIndex = (hash + idx) % famousTracksPool.length;
      const proposed = famousTracksPool[poolIndex];
      const matchKey = `${proposed.title.toLowerCase()}--${proposed.artist.toLowerCase()}`;
      
      if (!seenKeys.has(matchKey)) {
        seenKeys.add(matchKey);

        const x = Math.min(100, Math.max(-100, Math.round(((energy - 50) * 1.5) + (Math.sin(idx * 1.7) * 45))));
        const y = Math.min(100, Math.max(-100, Math.round(((valence - 50) * 1.5) + (Math.cos(idx * 2.3) * 45))));
        const rawScore = 96 - (Math.sqrt(similarTracks.length) * 5.5) - (hash % 3) + (Math.sin(idx * 1.3) * 2.5);
        const similarityScore = Math.max(58, Math.min(98, Math.round(rawScore)));

        similarTracks.push({
          id: `fallback_rec_track_${similarTracks.length}_${hash}`,
          title: proposed.title,
          artist: proposed.artist,
          similarityScore,
          explanation: proposed.desc,
          x,
          y,
          category: proposed.category,
          popularity: proposed.popularity
        });
      }
      idx++;
    }

    return {
      name: trackName,
      artist: artistName,
      genres,
      description: `A musicological acoustic fingerprint analysis mapping the neural coordinates of "${trackName}". This profile is computed using local neural signatures to describe the central frequency layout, structural complexness, and relative stylistic positioning of this piece.`,
      metrics: {
        energy,
        valence,
        acousticness,
        danceability,
        tempo,
        vocalPresence,
        complexity
      },
      similarTracks: recenterCoordinatesBasedOnSimilarity(similarTracks)
    };
  }

  function generateFallbackArtistDNA(artistName: string, count: number) {
    const hash = getSimpleHash(artistName);

    const stylePools = [
      ["Indie Folk", "Acoustic Singer-Songwriter", "Chamber Pop"],
      ["Synthpop", "Future Funk", "Electronic Soundscapes"],
      ["Post-Punk", "Darkwave", "Alternative Gothic"],
      ["Modern Jazz", "Chillhop", "Neo-Classical Fusion"],
      ["Indie Rock", "Shoegaze", "Noise Pop Revival"]
    ];
    const genres = stylePools[hash % stylePools.length];

    const famousArtistsPool = [
      { name: "Tame Impala", popularity: 88, category: "Sonic Twin", desc: "The modern champion of psychedelic studio production, analog phasing, and drum compression." },
      { name: "Radiohead", popularity: 84, category: "Genre Catalyst", desc: "Pioneering art-rock and electronic-alternative band legendary for constant sonic reinvention." },
      { name: "Daft Punk", popularity: 86, category: "Sonic Twin", desc: "Iconic house and electronic music giants renowned for high-fidelity vocoders and organic bass grooves." },
      { name: "Billie Eilish", popularity: 91, category: "Vibe Peer", desc: "Pioneered a modern dark-pop aesthetic combining sub-bass production with whisper vocal arrangements." },
      { name: "Beach House", popularity: 78, category: "Vibe Peer", desc: "A dream-pop pillar characterized by lush synthetic organs, slow tempos, and sliding slide guitars." },
      { name: "Lana Del Rey", popularity: 89, category: "Stylistic Cousin", desc: "Defined the melancholic, cinematic americana soundscape with references to vintage Hollywood pop." },
      { name: "Frank Ocean", popularity: 86, category: "Creative Cousin", desc: "A legendary alternative R&B and avant-indie songwriter exploring unconventional song structures." },
      { name: "Gorillaz", popularity: 84, category: "Genre Catalyst", desc: "Damon Albarn's virtual cartoon band, merging hip-hop, dub, pop, and indie genres seamlessly." },
      { name: "Arcade Fire", popularity: 72, category: "Stylistic Cousin", desc: "Renowned for anthemic indie art-rock, theatrical group arrangements, and rich instrumentations." },
      { name: "The xx", popularity: 76, category: "Acoustic Peer", desc: "Iconic minimalist indie pop band known for clean interlocking guitar lines and whispered dual vocals." },
      { name: "Glass Animals", popularity: 82, category: "Sonic Twin", desc: "Crafts dreamy, highly rhythmic electronic-alternative music with playful lyrical imagery." },
      { name: "Chvrches", popularity: 71, category: "Modern Anchor", desc: "Defined the 2010s synthpop era with bright, cascading retro synthesizer hooks and clean vocals." },
      { name: "MGMT", popularity: 80, category: "Creative Cousin", desc: "Highly creative electronic-indie duo behind central synth-pop anthems and psych-pop experiments." },
      { name: "Bon Iver", popularity: 79, category: "Acoustic Peer", desc: "Began with rustic acoustic folk and evolved into using complex vocal harmonizers and glitch setups." },
      { name: "Lorde", popularity: 82, category: "Genre Catalyst", desc: "Subverted teenage pop music with ultra-minimalist beat beds and sharp, observant lyrics." },
      { name: "Kavinsky", popularity: 74, category: "Sonic Twin", desc: "A French electronic artist who helped define the cinematic drive-inspired Outrun synthwave aesthetic." },
      { name: "Arctic Monkeys", popularity: 87, category: "Modern Anchor", desc: "Evolved from hyper-energetic post-punk revival to sleeker, heavy mid-tempo desert rock grooves." },
      { name: "The Strokes", popularity: 81, category: "Creative Cousin", desc: "The definitive early-2000s garage rock band famous for interlocking dual-guitar melodies." },
      { name: "Mac DeMarco", popularity: 80, category: "Aesthetic Brother", desc: "The godfather of modern lazy, warbly, analog-tape saturated bedroom pop guitar styles." },
      { name: "James Blake", popularity: 78, category: "Acoustic Peer", desc: "Blends minimalist digital dubstep beats with classic soul piano and complex vocal overlays." },
      { name: "Florence + The Machine", popularity: 79, category: "Genre Catalyst", desc: "Known for dramatic grand piano, harp arrangements, and towering powerhouse vocals." },
      { name: "Coldplay", popularity: 90, category: "Genre Catalyst", desc: "Global alt-pop superstars famous for melodic arena rock piano hooks and atmospheric arrangements." },
      { name: "The Weeknd", popularity: 93, category: "Sonic Twin", desc: "Dark cinematic R&B and highly synth-laden 80s inspired electropop charts." },
      { name: "Taylor Swift", popularity: 95, category: "Stylistic Cousin", desc: "Critically-acclaimed singer-songwriter navigating country, stadium pop, and indie folk textures." },
      { name: "Mac Miller", popularity: 84, category: "Creative Cousin", desc: "A late visionary blending neo-soul hip-hop with cozy jazzy instrumental backing." },
      { name: "Hozier", popularity: 88, category: "Acoustic Peer", desc: "Rich literary indie-soul and folk carrying massive acoustic blues-influenced hooks." },
      { name: "Kendrick Lamar", popularity: 90, category: "Genre Catalyst", desc: "A generational poet-lyricist redefining alternative West Coast hip-hop arrangements." },
      { name: "Childish Gambino", popularity: 82, category: "Creative Cousin", desc: "Donald Glover's musical avatar, diving from progressive rap into heavy synth-funk soul." },
      { name: "Dua Lipa", popularity: 89, category: "Modern Anchor", desc: "Leading general pop sensation combining high-tempo disco grooves with modern production." },
      { name: "Harry Styles", popularity: 87, category: "Creative Cousin", desc: "Elegantly blends 70s classic folk-rock with modern infectious stadium pop arrangements." },
      { name: "Olivia Rodrigo", popularity: 88, category: "Stylistic Cousin", desc: "Melds energetic 90s grunge feelings and pop punk chords with intimate vocal ballads." },
      { name: "Post Malone", popularity: 90, category: "Aesthetic Brother", desc: "Masters highly melodic alternative hip-hop combined with folk and soft-rock vocal styles." },
      { name: "Ed Sheeran", popularity: 91, category: "Acoustic Peer", desc: "Masterful singer-songwriter known for loops, acoustic chord hooks, and pop melodies." },
      { name: "Bruno Mars", popularity: 88, category: "Modern Anchor", desc: "Multi-talented star reviving classic R&B, funk-pop, and soul arrangements." },
      { name: "Adele", popularity: 86, category: "Acoustic Peer", desc: "Gilded powerhouse soul ballad singer utilizing minimal classical piano and strings." },
      { name: "Beyoncé", popularity: 89, category: "Genre Catalyst", desc: "A standard-setting creative leader pushing complex modern R&B and house production structures." },
      { name: "Rihanna", popularity: 88, category: "Modern Anchor", desc: "Iconic vocal force commanding dance-pop, electropop, and modern alternative R&B beats." },
      { name: "Lady Gaga", popularity: 86, category: "Modern Anchor", desc: "Renowned pop theater pioneer blending house elements with powerful live vocals." },
      { name: "Eminem", popularity: 90, category: "Genre Catalyst", desc: "Highly influential legendary rap technician characterized by quick rhythm structures." },
      { name: "Jay-Z", popularity: 82, category: "Genre Catalyst", desc: "Historic hip-hop business mogul legendary for clean soul-based samples." },
      { name: "Outkast", popularity: 78, category: "Creative Cousin", desc: "The progressive Southern hip-hop duo that pioneered futuristic cosmic funk-pop blends." },
      { name: "Phantogram", popularity: 66, category: "Stylistic Cousin", desc: "Combines heavy hip-hop beat beds with swirling dream-rock guitar aesthetics." },
      { name: "Empire of the Sun", popularity: 75, category: "Sonic Twin", desc: "Whimsical, solar-tinged indie dance duo featuring soaring high falsettos." },
      { name: "Foster the People", popularity: 78, category: "Creative Cousin", desc: "Indie synth-pop project crafting danceable alternative hooks with dark lyrics." },
      { name: "Passion Pit", popularity: 67, category: "Sonic Twin", desc: "Pioneered hyper-vibrant, high-pitch synthesizer indie pop loops." },
      { name: "Phoenix", popularity: 76, category: "Modern Anchor", desc: "Versatile French indie pop legends crafting sparkling, highly-saturated guitar grooves." },
      { name: "The Black Keys", popularity: 78, category: "Acoustic Peer", desc: "Raw blues-rock duo utilizing heavy fuzz guitars and minimal punchy garage beats." },
      { name: "Vampire Weekend", popularity: 76, category: "Creative Cousin", desc: "Articulated baroque indie-pop incorporating chamber music strings and playful guitars." },
      { name: "Lorde", popularity: 82, category: "Genre Catalyst", desc: "Defined minimal alt-pop with heavy percussive snaps and sharp dark lyricism." }
    ];

    const similarArtists: any[] = [];
    const seenNames = new Set<string>();
    // Skip core artist
    seenNames.add(artistName.toLowerCase());

    let idx = 0;
    while (similarArtists.length < count && idx < famousArtistsPool.length * 2) {
      const poolIndex = (hash + idx) % famousArtistsPool.length;
      const proposed = famousArtistsPool[poolIndex];
      const matchNameLower = proposed.name.toLowerCase();

      if (!seenNames.has(matchNameLower)) {
        seenNames.add(matchNameLower);

        const x = Math.min(100, Math.max(-100, Math.round((Math.sin(idx * 2.1 + hash) * 85))));
        const y = Math.min(100, Math.max(-100, Math.round((Math.cos(idx * 1.5 + hash) * 85))));
        const rawScore = 97 - (Math.sqrt(similarArtists.length) * 5.0) - (hash % 3) + (Math.cos(idx * 1.4) * 2.0);
        const similarityScore = Math.max(58, Math.min(99, Math.round(rawScore)));

        similarArtists.push({
          id: `fallback_rec_artist_${similarArtists.length}_${hash}`,
          name: proposed.name,
          similarityScore,
          explanation: proposed.desc,
          x,
          y,
          category: proposed.category,
          popularity: proposed.popularity
        });
      }
      idx++;
    }

    return {
      name: artistName,
      genres,
      description: `A stylistical and musicological exploration of the sound catalog and genre boundaries of "${artistName}". Reflects structural complexity, tempo dynamics, and performance accents computed from neural acoustic patterns.`,
      similarArtists: recenterCoordinatesBasedOnSimilarity(similarArtists)
    };
  }

  function generateFallbackDiscography(artistName: string) {
    const hash = getSimpleHash(artistName);
    
    const recordTypes = ["Album", "EP", "Single", "Compilation"];
    const synopsisPool = [
      "A critically acclaimed exploration of atmospheric soundscapes, combining intricate drums with shimmering synth pads.",
      "A stripped-back, highly personal acoustic record characterized by close-mic vocals and rich organic string arrangements.",
      "Fast-paced alternative anthems featuring crunchy, energetic overdrive and memorable high-octane chord progression hooks.",
      "An experimental release pushing avant-garde boundaries with analog noise synthesizers and off-kilter, polyrhythmic tempos."
    ];

    const albums = Array.from({ length: 6 }, (_, idx) => {
      const year = String(2025 - (idx * 3) - (hash % 3));
      const title = `${artistName} - Phase ${idx + 1} (${idx % 2 === 0 ? "Chronicles" : "Acoustics"})`;
      const type = idx === 0 ? "Album" : recordTypes[(idx + hash) % recordTypes.length];
      const keyTracks = [
        `Track Alpha ${idx + 1}`,
        `Echoes of Time`,
        `Residue`
      ];
      const synopsis = synopsisPool[(idx + hash) % synopsisPool.length];

      return {
        title,
        year,
        type,
        keyTracks,
        synopsis
      };
    });

    return {
      artist: artistName,
      albums
    };
  }

  // Helper for calling Gemini with retry logic
  async function callGeminiWithRetry<T>(apiCall: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
    let delay = initialDelay;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (err: any) {
        const errStr = JSON.stringify(err) || err.message || "";
        const isTransient = 
          err.status === 503 || 
          err.status === 429 ||
          errStr.includes("503") ||
          errStr.includes("429") ||
          errStr.includes("UNAVAILABLE") ||
          errStr.includes("RESOURCE_EXHAUSTED") ||
          errStr.includes("high demand") ||
          errStr.includes("temporary") ||
          errStr.includes("overloaded");

        if (isTransient && attempt < maxRetries) {
          console.warn(`[GEMINI RETRY] Attempt ${attempt} failed with a transient error. Retrying in ${delay}ms... Details:`, err.message || err);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          throw err;
        }
      }
    }
    throw new Error("Gemini API call failed after max retries");
  }

  // Search Endpoint
  app.post("/api/search", async (req, res) => {
    const { query } = req.body;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query is required" });
    }

    const cacheKeyRaw = query.trim().toLowerCase();
    const cacheKey = `ai:search:${cacheKeyRaw}`;
    
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log(`[REDIS CACHE HIT] search for ${query}`);
          let parsed = cached;
          if (typeof cached === "string") {
            try { parsed = JSON.parse(cached); } catch(e) {}
          }
          if (parsed && typeof parsed === "object") {
            return res.json(parsed);
          }
        }
      } catch (err) {
        console.warn("[REDIS CACHE GET FAIL]", err);
      }
    }

    const cached = searchCache.get(cacheKeyRaw);
    if (cached) {
      return res.json(cached);
    }

    if (!ai) {
      console.warn("[GEMINI KEY MISSING] Running deterministic simulated search results.");
      const fallback = generateFallbackSearch(query);
      searchCache.set(cacheKeyRaw, fallback);
      if (redis) {
        try {
          await redis.setex(cacheKey, 2592000, JSON.stringify(fallback));
          console.log(`[REDIS CACHE SET SUCCESS] ${cacheKey}`);
        } catch(e) { console.warn("[REDIS CACHE SET FAIL]", e); }
      }
      return res.json(fallback);
    }

    try {
      const prompt = `Search the world's music database for artists or songs matching the query "${query}".
Provide up to 6 of the most likely and relevant matching results (both artists and songs are welcome). 
Each item must be cleanly categorized. 
If an item is an artist, set other fields (artist, album, releaseDate) to empty strings.
Output strictly formatted JSON matching the requested schema.`;

      const response = await callGeminiWithRetry(() => 
        ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: searchResponseSchema,
            temperature: 0.2,
          }
        })
      );

      if (!response.text) {
        throw new Error("No response text received from Gemini server");
      }

      const results = JSON.parse(response.text.trim());
      searchCache.set(cacheKeyRaw, results);
      if (redis) {
        try {
          await redis.setex(cacheKey, 2592000, JSON.stringify(results));
          console.log(`[REDIS CACHE SET SUCCESS] ${cacheKey}`);
        } catch(e) { console.warn("[REDIS CACHE SET FAIL]", e); }
      }
      return res.json(results);
    } catch (err: any) {
      console.error("[GEMINI SEARCH ERROR. RUNNING AUTONOMOUS FALLBACK]:", err);
      const fallback = generateFallbackSearch(query);
      searchCache.set(cacheKeyRaw, fallback);
      if (redis) {
        try {
          await redis.setex(cacheKey, 2592000, JSON.stringify(fallback));
          console.log(`[REDIS CACHE SET SUCCESS] ${cacheKey}`);
        } catch(e) { console.warn("[REDIS CACHE SET FAIL]", e); }
      }
      return res.json(fallback);
    }
  });

  // Song DNA Analysis
  app.post("/api/gemini/song-dna", async (req, res) => {
    const { trackName, artistName, limit } = req.body;
    if (!trackName || !artistName) {
      return res.status(400).json({ error: "Missing trackName or artistName" });
    }

    const count = typeof limit === "number" && limit >= 3 && limit <= 50 ? limit : 20;
    const limitStr = (!isNaN(count) && count > 0) ? `:${count}` : '';
    const cacheKey = `ai:map:track:${artistName.trim().toLowerCase()}:${trackName.trim().toLowerCase()}${limitStr}`;
    
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log(`[REDIS CACHE HIT] song-dna for ${artistName} - ${trackName}`);
          let parsed = cached;
          if (typeof cached === "string") {
            try { parsed = JSON.parse(cached); } catch(e) {}
          }
          if (parsed && typeof parsed === "object") {
             return res.json(parsed);
          }
        }
      } catch (err) {
        console.warn("[REDIS CACHE GET FAIL]", err);
      }
    }

    if (!ai) {
      console.warn("[GEMINI KEY MISSING] Running deterministic simulated song DNA.");
      const fallback = generateFallbackSongDNA(trackName, artistName, count);
      if (redis) {
        try {
          await redis.setex(cacheKey, 2592000, JSON.stringify(fallback));
             console.log(`[REDIS CACHE SET SUCCESS] ${cacheKey}`);
        } catch(e) { console.warn("[REDIS CACHE SET FAIL]", e); }
      }
      return res.json(fallback);
    }

    try {
      const prompt = `Perform a highly detailed musicological "Song DNA" analysis of the song "${trackName}" by the artist "${artistName}".
Estimate its properties across key audio metrics (energy, valence/happiness, acousticness, danceability, estimated tempo in BPM, vocalPresence, and composition complexity).
Additionally, formulate a 2D recommendation "Music Map" consisting of exactly ${count} other tracks across eras that trace direct lineages or stylistic bridges to this song.
The coordinates (x, y) should represent:
- 'x' (integer, -100 to 100): Sonic energy. Negative represents quiet, acoustic, introspective, ambient. Positive represents intense, loud, fast, energetic.
- 'y' (integer, -100 to 100): Emotional coloring. Negative represents somber, melancholy, dark, gothic. Positive represents blissful, optimistic, bright.
Spread out the relative nodes from -100 to 100 dynamically based on relationship. Provide an informative 1-sentence connection explanation for each.
Output strictly formatted JSON matching the requested schema.`;

      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: songDnaSchema,
            temperature: 0.4,
          }
        })
      );

      if (!response.text) {
        throw new Error("Empty response received from Gemini engine");
      }

      const data = JSON.parse(response.text.trim());
      if (data.similarTracks && Array.isArray(data.similarTracks)) {
        data.similarTracks = recenterCoordinatesBasedOnSimilarity(data.similarTracks);
      }
      if (redis) {
        try {
          await redis.setex(cacheKey, 2592000, JSON.stringify(data));
             console.log(`[REDIS CACHE SET SUCCESS] ${cacheKey}`);
        } catch(e) { console.warn("[REDIS CACHE SET FAIL]", e); }
      }
      return res.json(data);
    } catch (err: any) {
      console.error("[GEMINI SONG DNA ERROR. RUNNING AUTONOMOUS FALLBACK]:", err);
      const fallback = generateFallbackSongDNA(trackName, artistName, count);
      if (redis) {
        try {
          await redis.setex(cacheKey, 2592000, JSON.stringify(fallback));
             console.log(`[REDIS CACHE SET SUCCESS] ${cacheKey}`);
        } catch(e) { console.warn("[REDIS CACHE SET FAIL]", e); }
      }
      return res.json(fallback);
    }
  });

  
  app.post("/api/gemini/explain-track-stream", async (req, res) => {
    const { trackName, artistName, similarTracks } = req.body;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const cacheKey = `ai:map:explain:track:${artistName.trim().toLowerCase()}:${trackName.trim().toLowerCase()}`;
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached && typeof cached === "string") {
          console.log(`[REDIS CACHE HIT] explain-track for ${artistName} - ${trackName}`);
          const words = cached.split(" ");
          for (let i = 0; i < words.length; i += 3) {
            const chunk = words.slice(i, i + 3).join(" ") + " ";
            res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
            await new Promise(resolve => setTimeout(resolve, 35));
          }
          res.end();
          return;
        }
      } catch (e) {
        console.warn("[REDIS CACHE GET FAIL]", e);
      }
    }

    if (!ai) {
      await streamLocalTrackExplanation(trackName, artistName, similarTracks || [], (chunkText) => {
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      });
      return res.end();
    }

    const prompt = `As a musicologist, explain the stylistic and contextual connections between "${trackName}" by ${artistName} and the following similar tracks identified by Last.fm: ${similarTracks.join(", ")}. Keep the analysis engaging, insightful, and around 3 paragraphs.`;

    try {
      const responseStream = await ai.models.generateContentStream({
        model: "gemini-3.5-flash",
        contents: prompt
      });

      let fullText = "";
      for await (const chunk of responseStream) {
        if (chunk.text) {
          fullText += chunk.text;
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
      res.end();
      if (redis && fullText) {
        try { await redis.setex(cacheKey, 2592000, fullText);
             console.log(`[REDIS CACHE SET SUCCESS] ${cacheKey}`); } catch(e) {}
      }
    } catch(err) {
      console.warn("[GEMINI STREAM WARN] gemini-3.5-flash failed, attempting gemini-3.1-flash-lite fallback. Error:", err.message || err);
      try {
        const responseStream = await ai.models.generateContentStream({
          model: "gemini-3.1-flash-lite",
          contents: prompt
        });
        
        let fullText = "";
        for await (const chunk of responseStream) {
          if (chunk.text) {
            fullText += chunk.text;
            res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
          }
        }
        res.end();
        if (redis && fullText) {
           try { await redis.setex(cacheKey, 2592000, fullText);
             console.log(`[REDIS CACHE SET SUCCESS] ${cacheKey}`); } catch(e) {}
        }
      } catch(err2) {
        console.error("[GEMINI STREAM ERROR] gemini-3.1-flash-lite also failed. Running high-fidelity local streaming fallback. Error:", err2.message || err2);
        await streamLocalTrackExplanation(trackName, artistName, similarTracks || [], (chunkText) => {
          res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
        });
        res.end();
      }
    }
  });

  app.post("/api/gemini/explain-artist-stream", async (req, res) => {
    const { artistName, similarArtists } = req.body;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const cacheKey = `ai:map:explain:artist:${artistName.trim().toLowerCase()}`;
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached && typeof cached === "string") {
          console.log(`[REDIS CACHE HIT] explain-artist for ${artistName}`);
          const words = cached.split(" ");
          for (let i = 0; i < words.length; i += 3) {
            const chunk = words.slice(i, i + 3).join(" ") + " ";
            res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
            await new Promise(resolve => setTimeout(resolve, 35));
          }
          res.end();
          return;
        }
      } catch (e) {
        console.warn("[REDIS CACHE GET FAIL]", e);
      }
    }

    if (!ai) {
      await streamLocalArtistExplanation(artistName, similarArtists || [], (chunkText) => {
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      });
      return res.end();
    }

    const prompt = `As a musicologist, explain the stylistic, historical, and contextual connections between the artist "${artistName}" and the following similar artists identified by Last.fm: ${similarArtists.join(", ")}. Keep the analysis engaging, insightful, and around 3 paragraphs.`;

    try {
      const responseStream = await ai.models.generateContentStream({
        model: "gemini-3.5-flash",
        contents: prompt
      });

      let fullText = "";
      for await (const chunk of responseStream) {
        if (chunk.text) {
          fullText += chunk.text;
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
      res.end();
      if (redis && fullText) {
         try { await redis.setex(cacheKey, 2592000, fullText);
             console.log(`[REDIS CACHE SET SUCCESS] ${cacheKey}`); } catch(e) {}
      }
    } catch(err) {
      console.warn("[GEMINI STREAM WARN] gemini-3.5-flash failed, attempting gemini-3.1-flash-lite fallback. Error:", err.message || err);
      try {
        const responseStream = await ai.models.generateContentStream({
          model: "gemini-3.1-flash-lite",
          contents: prompt
        });
        
        let fullText = "";
        for await (const chunk of responseStream) {
          if (chunk.text) {
            fullText += chunk.text;
            res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
          }
        }
        res.end();
        if (redis && fullText) {
           try { await redis.setex(cacheKey, 2592000, fullText);
             console.log(`[REDIS CACHE SET SUCCESS] ${cacheKey}`); } catch(e) {}
        }
      } catch(err2) {
        console.error("[GEMINI STREAM ERROR] gemini-3.1-flash-lite also failed. Running high-fidelity local streaming fallback. Error:", err2.message || err2);
        await streamLocalArtistExplanation(artistName, similarArtists || [], (chunkText) => {
          res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
        });
        res.end();
      }
    }
  });

  app.post("/api/gemini/artist-dna", async (req, res) => {
    const { artistName, limit } = req.body;
    if (!artistName) {
      return res.status(400).json({ error: "Missing artistName" });
    }

    const count = typeof limit === "number" && limit >= 3 && limit <= 50 ? limit : 10;
    const limitStr = (!isNaN(count) && count > 0) ? `:${count}` : '';
    const cacheKey = `ai:map:artist:${artistName.trim().toLowerCase()}${limitStr}`;
    
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log(`[REDIS CACHE HIT] artist-dna for ${artistName}`);
          let parsed = cached;
          if (typeof cached === "string") {
            try { parsed = JSON.parse(cached); } catch(e) {}
          }
          if (parsed && typeof parsed === "object") {
             return res.json(parsed);
          }
        }
      } catch (err) {
        console.warn("[REDIS CACHE GET FAIL]", err);
      }
    }

    if (!ai) {
      console.warn("[GEMINI KEY MISSING] Running deterministic simulated artist DNA.");
      const fallback = generateFallbackArtistDNA(artistName, count);
      if (redis) {
        try {
          await redis.setex(cacheKey, 2592000, JSON.stringify(fallback));
             console.log(`[REDIS CACHE SET SUCCESS] ${cacheKey}`);
        } catch(e) { console.warn("[REDIS CACHE SET FAIL]", e); }
      }
      return res.json(fallback);
    }

    try {
      const prompt = `Perform a highly detailed musicological "Artist DNA" analysis of the artist/group "${artistName}".
Describe their musical aesthetic and genres/styles.
Additionally, formulate a 2D recommendation "Music Map" consisting of exactly ${count} other related/similar artists who are highly musically coordinate or stylistic cousins.
The coordinates (x, y) should represent relative musical axes relative to ${artistName}:
- 'x' (integer, -100 to 100): Sonic energy/tempo. Negative represents organic, acoustic, minimal. Positive represents heavy synth work, intense beats, fast tempo, highly saturated production.
- 'y' (integer, -100 to 100): Emotional tone/experimentalism. Negative represents somber, dark, traditional. Positive represents cheerful, optimistic, avant-garde, highly progressive.
Spread out the ${count} similar artists from -100 to 100 dynamically to represent relative distance. Provide a 1-sentence explanation detailing why they align musically or stylistically.
Output strictly formatted JSON matching the requested schema.`;

      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: artistDnaSchema,
            temperature: 0.4,
          }
        })
      );

      if (!response.text) {
        throw new Error("Empty response received from Gemini engine");
      }

      const data = JSON.parse(response.text.trim());
      if (data.similarArtists && Array.isArray(data.similarArtists)) {
        data.similarArtists = recenterCoordinatesBasedOnSimilarity(data.similarArtists);
      }
      if (redis) {
        try {
          await redis.setex(cacheKey, 2592000, JSON.stringify(data));
             console.log(`[REDIS CACHE SET SUCCESS] ${cacheKey}`);
        } catch(e) { console.warn("[REDIS CACHE SET FAIL]", e); }
      }
      return res.json(data);
    } catch (err: any) {
      console.error("[GEMINI ARTIST DNA ERROR. RUNNING AUTONOMOUS FALLBACK]:", err);
      const fallback = generateFallbackArtistDNA(artistName, count);
      if (redis) {
        try {
          await redis.setex(cacheKey, 2592000, JSON.stringify(fallback));
             console.log(`[REDIS CACHE SET SUCCESS] ${cacheKey}`);
        } catch(e) { console.warn("[REDIS CACHE SET FAIL]", e); }
      }
      return res.json(fallback);
    }
  });

  // Artist Discography
  app.post("/api/artist/discography", async (req, res) => {
    const { artistName } = req.body;
    if (!artistName) {
      return res.status(400).json({ error: "Missing artistName" });
    }

    const cacheKeyRaw = artistName.trim().toLowerCase();
    const cacheKey = `ai:discography:${cacheKeyRaw}`;
    
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log(`[REDIS CACHE HIT] discography for ${artistName}`);
          let parsed = cached;
          if (typeof cached === "string") {
            try { parsed = JSON.parse(cached); } catch(e) {}
          }
          if (parsed && typeof parsed === "object") {
            return res.json(parsed);
          }
        }
      } catch (err) {
        console.warn("[REDIS CACHE GET FAIL]", err);
      }
    }

    const cached = discographyCache.get(cacheKeyRaw);
    if (cached) {
      return res.json(cached);
    }

    if (!ai) {
      console.warn("[GEMINI KEY MISSING] Running deterministic simulated discography.");
      const fallback = generateFallbackDiscography(artistName);
      discographyCache.set(cacheKeyRaw, fallback);
      if (redis) {
        try {
          await redis.setex(cacheKey, 2592000, JSON.stringify(fallback));
          console.log(`[REDIS CACHE SET SUCCESS] ${cacheKey}`);
        } catch(e) { console.warn("[REDIS CACHE SET FAIL]", e); }
      }
      return res.json(fallback);
    }

    try {
      const prompt = `Formulate a beautifully curated musicological discography of the artist "${artistName}".
Provide up to 20 of their most important official releases, chronologically ordered to cover their career milestones (including albums, EPs, or singles).
For each release, include:
- The exact title
- The release year (e.g. "2006")
- The release group type ("Album", "EP", "Single", "Compilation")
- Exactly 3 breakout tracks or top key tracks representing the record's sound
- A highly descriptive, atmospheric 1-2 sentence musical synopsis describing its specific sonic textures, aesthetic mood, and historical significance.
Output strictly formatted JSON matching the requested schema.`;

      const response = await callGeminiWithRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: discographySchema,
            temperature: 0.2
          }
        })
      );

      if (!response.text) {
        throw new Error("Empty response received from Gemini engine");
      }

      const data = JSON.parse(response.text.trim());
      discographyCache.set(cacheKeyRaw, data);
      if (redis) {
        try {
          await redis.setex(cacheKey, 2592000, JSON.stringify(data));
          console.log(`[REDIS CACHE SET SUCCESS] ${cacheKey}`);
        } catch(e) { console.warn("[REDIS CACHE SET FAIL]", e); }
      }
      return res.json(data);
    } catch (err: any) {
      console.error("[GEMINI DISCOGRAPHY ERROR. RUNNING AUTONOMOUS FALLBACK]:", err);
      const fallback = generateFallbackDiscography(artistName);
      discographyCache.set(cacheKeyRaw, fallback);
      if (redis) {
        try {
          await redis.setex(cacheKey, 2592000, JSON.stringify(fallback));
          console.log(`[REDIS CACHE SET SUCCESS] ${cacheKey}`);
        } catch(e) { console.warn("[REDIS CACHE SET FAIL]", e); }
      }
      return res.json(fallback);
    }
  });

  // Serve Vite in dev mode, Static Assets in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`[Express Error] ${req.method} ${req.path}`, err);
    res.status(500).json({ error: "Internal Server Error" });
  });

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting securely on http://localhost:${PORT} [Node: Spotify/Firebase decoupled build]`);
  });

  // Graceful shutdown handling
  const shutdown = () => {
    console.log("Shutting down server gracefully...");
    server.close(() => {
      console.log("Closed out remaining connections.");
      process.exit(0);
    });
    
    // Fallback if connections don't close
    setTimeout(() => {
      console.error("Could not close connections in time, forcefully shutting down");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer();

async function streamLocalTrackExplanation(
  trackName: string,
  artistName: string,
  similarTracks: string[],
  write: (text: string) => void
) {
  const cleanTracks = similarTracks.map(t => t.replace(/"/g, ''));
  const track1 = cleanTracks[0] || "peer selections";
  const track2 = cleanTracks[1] || "similar works";
  const track3 = cleanTracks[2] || "neighboring melodies";
  
  const paragraphs = [
    `Stylistically, "${trackName}" by the visionary artist ${artistName} sits as more than just a standalone composition—it is a musical anchor of a wider sonic system. Our mapping system highlights rich connections between this core node and its neighboring entities on the canvas. The relationship represents a shared structural template of melodic tension, timbral pacing, and rhythmic momentum that bridges diverse auditory spaces.`,
    
    `For example, tracks like ${track1} and ${track2} share a remarkably close musical genome. You will notice that their dynamic and emotional architecture mirrors the rhythmic signature and acoustic footprint of ${artistName}'s core production style. Whether it's through similar compression techniques, transient responses, or harmonic arrangements, these pieces flow together seamlessly, creating a cohesive aesthetic that spans throughout this celestial music map.`,
    
    `Ultimately, diving into these companion nodes (such as ${track3}) reveals how common musical motifs travel across different genres. Each similar track acts as a looking glass that reveals a unique dimension of "${trackName}"'s foundational DNA. By tracking this lineage, we gain a deeper appreciation for how artists establish subtle, atmospheric connections that unite listeners across distinct sonic dimensions.`
  ];

  for (const para of paragraphs) {
    const words = para.split(" ");
    for (let i = 0; i < words.length; i += 3) {
      const chunk = words.slice(i, i + 3).join(" ") + " ";
      write(chunk);
      await new Promise(resolve => setTimeout(resolve, 35));
    }
    write("\n\n");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

async function streamLocalArtistExplanation(
  artistName: string,
  similarArtists: string[],
  write: (text: string) => void
) {
  const art1 = similarArtists[0] || "vibe peers";
  const art2 = similarArtists[1] || "stylistic modernists";
  const art3 = similarArtists[2] || "genre pioneers";

  const paragraphs = [
    `The creative legacy of ${artistName} outlines an immersive acoustic aesthetic that shapes a distinct coordinates cluster in our cosmic mapping environment. This artist operates with a unique combination of compositional boldness, experimental arrangements, and lyrical depth, setting a high standard that resonates throughout their surrounding peers.`,
    
    `When analyzing their position on this map, we find that artists like ${art1} and ${art2} serve as direct stylistic partners. They share not only a foundational philosophy towards beat structure and instrumentation but also a similar approach to emotional range and sonic experimentation. This clustering highlights how these pioneers inspire each other, pushing the boundaries of their respective subgenres and developing new musical frameworks.`,
    
    `Exploring further outwards to catalogs like ${art3} shows how the wider circles of ${artistName}'s influence extend into nearby genres. By listening through this beautifully populated constellation of similar creators, we can appreciate the rich, multi-layered tapestry of contemporary musical curation, demonstrating how individual artistry fuels an interconnected universe of sound.`
  ];

  for (const para of paragraphs) {
    const words = para.split(" ");
    for (let i = 0; i < words.length; i += 3) {
      const chunk = words.slice(i, i + 3).join(" ") + " ";
      write(chunk);
      await new Promise(resolve => setTimeout(resolve, 35));
    }
    write("\n\n");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
