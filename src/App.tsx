import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { 
  Music, 
  Disc, 
  Search, 
  Sparkles, 
  Compass, 
  Layers, 
  TrendingUp, 
  Clock, 
  LogOut, 
  Activity, 
  MapPin, 
  Volume2, 
  Play, 
  Pause, 
  User, 
  ExternalLink,
  ChevronRight,
  Info,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  X,
  UploadCloud,
  Award,
  Trash2,
  History
} from "lucide-react";
import { SpotifyTrack, SpotifyProfile, SongDNA, ConnectionNode, ArtistDNA, ArtistConnectionNode, ArtistDiscography } from "./types";
import { ConstellationMap } from './components/ConstellationMap';
import { isPlaceholderImage } from './utils';
import { SafeImage } from './components/SafeImage';
import { DEMO_SHORT_TERM_TRACKS, DEMO_MEDIUM_TERM_TRACKS, DEMO_LONG_TERM_TRACKS } from "./demoData";

const STAGE_MESSAGES = [
  "Formulating neural audio graph...",
  "Querying musicologist consensus layers...",
  "Calibrating acoustic metrics (acousticness, danceability)...",
  "Tracing historical stylistic correlations...",
  "Positioning coordinate vectors (-100 to 100 range)...",
  "Stitching cosmic constellation nodes..."
];

const ARTIST_MOCK_IMAGES = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?q=80&w=200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?q=80&w=200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1521119989659-a83eee488004?q=80&w=200&auto=format&fit=crop"
];




export default function App() {
  // Token State (compatibility layer)
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number>(0);

  // Application Modes: set sandbox to true so we always bypass active Spotify token lookups
  const [isSandbox, setIsSandbox] = useState<boolean>(true);

  // State modules
  const [userProfile, setUserProfile] = useState<SpotifyProfile | null>({
    id: "guest_voyager",
    display_name: "Guest Voyager",
    images: [{ url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop" }]
  });
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>(DEMO_MEDIUM_TERM_TRACKS);
  const [topRange, setTopRange] = useState<"short_term" | "medium_term" | "long_term">("medium_term");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [recentSearches, setRecentSearches] = useState<{name: string, artist?: string, id: string, image?: string, isArtist?: boolean}[]>(() => {
    const saved = localStorage.getItem("beat_browser_recent_searches") || localStorage.getItem("sonic_dna_recent_searches");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return []; }
    }
    return [];
  });
  const [activeTab, setActiveTab] = useState<"search" | "favorites" | "streaming_history">("search");

  // Local offline-first states (replacing Firebase collection)
  const [fbUser, setFbUser] = useState<any>({ uid: "local_user", displayName: "Guest Voyager" });
  const [fbFavorites, setFbFavorites] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("starDNA_favorites") || "[]");
    } catch {
      return [];
    }
  });
  const [isFbLoading, setIsFbLoading] = useState(false);
  const [isSavingFav, setIsSavingFav] = useState(false);

  // Loading indicator states
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isTracklistLoading, setIsTracklistLoading] = useState(false);
  const [isDNALoading, setIsDNALoading] = useState(false);
  const [dnaError, setDnaError] = useState<string | null>(null);
  
  // Active Modeling Target Track
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrack | null>(null);

  // Stub authentication helpers for guest mode
  const signInWithGoogle = () => console.log("Guest Voyager always activated.");
  const signOutUser = () => console.log("Guest Voyager remains on deck.");

  // Overlap Prevention Logic for Constellation Maps (Forces spacing of close nodes)
  const resolveNodeOverlaps = <T extends { x: number; y: number }>(nodes: T[], minDistance = 21): T[] => {
    const adjusted = nodes.map(n => ({ ...n }));
    
    // 1. Move nodes away from extreme absolute center overlap
    for (let i = 0; i < adjusted.length; i++) {
      const dCenter = Math.sqrt(adjusted[i].x * adjusted[i].x + adjusted[i].y * adjusted[i].y);
      if (dCenter < 14) {
        const angle = dCenter > 0 ? Math.atan2(adjusted[i].y, adjusted[i].x) : (i / adjusted.length) * Math.PI * 2;
        // Radial distribution circle push
        adjusted[i].x = Math.round(Math.cos(angle) * 14);
        adjusted[i].y = Math.round(Math.sin(angle) * 14);
      }
    }

    // 2. Iterative repulsion vectors
    for (let iter = 0; iter < 45; iter++) {
      let moved = false;
      for (let i = 0; i < adjusted.length; i++) {
        for (let j = i + 1; j < adjusted.length; j++) {
          const dx = adjusted[i].x - adjusted[j].x;
          const dy = adjusted[i].y - adjusted[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < minDistance) {
            moved = true;
            const overlap = minDistance - dist;
            // Calculate overlap direction with random jitter to resolve direct alignment
            const jitter = 0.05 * (Math.random() - 0.5);
            const angle = dist > 0.001 ? Math.atan2(dy, dx) : (i / adjusted.length) * Math.PI * 2 + jitter;
            const pushX = Math.cos(angle) * (overlap / 2 || 1);
            const pushY = Math.sin(angle) * (overlap / 2 || 1);
            
            adjusted[i].x += pushX;
            adjusted[i].y += pushY;
            adjusted[j].x -= pushX;
            adjusted[j].y -= pushY;
          }
        }
      }
      if (!moved) break;
    }

    // 3. Prevent clipping outside coordinate bounds of visual viewport window
    for (let i = 0; i < adjusted.length; i++) {
      adjusted[i].x = Math.max(-108, Math.min(108, Math.round(adjusted[i].x)));
      adjusted[i].y = Math.max(-108, Math.min(108, Math.round(adjusted[i].y)));
    }

    return adjusted;
  };

  const [songDNAState, setSongDNAState] = useState<SongDNA | null>(null);
  const songDNA = songDNAState;
  const setSongDNA = (dna: SongDNA | null | ((prev: SongDNA | null) => SongDNA | null)) => {
    if (typeof dna === "function") {
      setSongDNAState(prev => {
        const resolved = dna(prev);
        if (resolved && resolved.similarTracks) {
          resolved.similarTracks = resolveNodeOverlaps(resolved.similarTracks, 21);
        }
        return resolved;
      });
    } else {
      if (dna && dna.similarTracks) {
        dna.similarTracks = resolveNodeOverlaps(dna.similarTracks, 21);
      }
      setSongDNAState(dna);
    }
  };

  const [selectedConstellationNode, setSelectedConstellationNode] = useState<ConnectionNode | null>(null);
  const [mapZoom, setMapZoom] = useState(1.1); // slightly bigger initial zoom
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const mapDragStart = useRef({ x: 0, y: 0 });
  const mapOffsetStart = useRef({ x: 0, y: 0 });
  const constellationCanvasRef = useRef<HTMLDivElement | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [mapEngine, setMapEngine] = useState<"gemini" | "spotify">("gemini");
  const [constellationSizeAI, setConstellationSizeAI] = useState<number>(50);
  const [constellationSizeAPI, setConstellationSizeAPI] = useState<number>(50);
  const constellationSize = mapEngine === "gemini" ? constellationSizeAI : constellationSizeAPI;

  // Artist Map & Fullscreen states
  const [activeMapType, setActiveMapType] = useState<"song" | "artist">("song");
  
  const [artistDNAState, setArtistDNAState] = useState<ArtistDNA | null>(null);
  const artistDNA = artistDNAState;
  const setArtistDNA = (dna: ArtistDNA | null | ((prev: ArtistDNA | null) => ArtistDNA | null)) => {
    if (typeof dna === "function") {
      setArtistDNAState(prev => {
        const resolved = dna(prev);
        if (resolved && resolved.similarArtists) {
          resolved.similarArtists = resolveNodeOverlaps(resolved.similarArtists, 21);
        }
        return resolved;
      });
    } else {
      if (dna && dna.similarArtists) {
        dna.similarArtists = resolveNodeOverlaps(dna.similarArtists, 21);
      }
      setArtistDNAState(dna);
    }
  };

  const [selectedArtistConstellationNode, setSelectedArtistConstellationNode] = useState<ArtistConnectionNode | null>(null);
  const [isArtistDNALoading, setIsArtistDNALoading] = useState(false);
  const [isFullscreenMap, setIsFullscreenMap] = useState(false);

  // Familiarity Level Filter state: "all", "familiar" (popularity >= 60), "mainstream" (popularity >= 80)
  const [familiarityLevel, setFamiliarityLevel] = useState<"all" | "familiar" | "mainstream">("all");

  // Discovery Mode: "curiosity" (prioritizes unplayed/discovery recommendations) or "nostalgia" (prioritizes previously listened track history)
  const [discoveryMode, setDiscoveryMode] = useState<"curiosity" | "nostalgia">("curiosity");

  // Artist discography drawer states
  const [isDiscographyOpen, setIsDiscographyOpen] = useState(false);
  const [activeDiscography, setActiveDiscography] = useState<ArtistDiscography | null>(null);
  const [isDiscographyLoading, setIsDiscographyLoading] = useState(false);
  const [discographyError, setDiscographyError] = useState<string | null>(null);

  // IndexedDB Helper
  const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("SonicDNA_DB", 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("history")) {
          db.createObjectStore("history");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  // Streaming History State Engine
  const [streamingData, setStreamingData] = useState<{
    raw: any[];
    minDate: Date | null;
    maxDate: Date | null;
    totalPlays: number;
    loadedFilesCount: number;
  } | null>(null);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const db = await openDB();
        const tx = db.transaction("history", "readonly");
        const store = tx.objectStore("history");
        const request = store.get("streaming_summary");
        
        request.onsuccess = () => {
          if (request.result) {
            const parsed = request.result;
            setStreamingData({
              raw: parsed.raw || [],
              minDate: parsed.minDate ? new Date(parsed.minDate) : null,
              maxDate: parsed.maxDate ? new Date(parsed.maxDate) : null,
              totalPlays: parsed.totalPlays || 0,
              loadedFilesCount: parsed.loadedFilesCount || 0
            });
          } else {
             const cached = localStorage.getItem("spotify_streaming_summary_v1");
             if (cached) {
               try {
                 const parsed = JSON.parse(cached);
                 setStreamingData({
                   raw: parsed.raw || [],
                   minDate: parsed.minDate ? new Date(parsed.minDate) : null,
                   maxDate: parsed.maxDate ? new Date(parsed.maxDate) : null,
                   totalPlays: parsed.totalPlays || 0,
                   loadedFilesCount: parsed.loadedFilesCount || 0
                 });
               } catch (e) {}
             }
          }
        };
      } catch (err) {
        console.warn("Failed to read IndexedDB", err);
      }
    };
    hydrate();
  }, []);

  const [isParsingStreaming, setIsParsingStreaming] = useState(false);
  const [streamingParseError, setStreamingParseError] = useState<string | null>(null);
  const [streamingFilesCount, setStreamingFilesCount] = useState(0);

  // Filters within streaming history tab
  const [streamingRange, setStreamingRange] = useState<"all_time" | "last_6_months" | "last_month">("all_time");
  const [streamingCategory, setStreamingCategory] = useState<"tracks" | "artists" | "albums">("tracks");
  const [streamingSearch, setStreamingSearch] = useState("");

  const saveStreamingDataWithQuotaGuard = async (data: {
    raw: any[];
    minDate: Date | null;
    maxDate: Date | null;
    totalPlays: number;
    loadedFilesCount: number;
  } | null) => {
    setStreamingData(data);
    
    try {
      const db = await openDB();
      const tx = db.transaction("history", "readwrite");
      if (!data) {
        tx.objectStore("history").delete("streaming_summary");
        localStorage.removeItem("spotify_streaming_summary_v1");
      } else {
        const summaryString = {
          raw: data.raw,
          minDate: data.minDate?.toISOString() || null,
          maxDate: data.maxDate?.toISOString() || null,
          totalPlays: data.totalPlays,
          loadedFilesCount: data.loadedFilesCount
        };
        tx.objectStore("history").put(summaryString, "streaming_summary");
      }
    } catch (e) {
      console.warn("Storage quota exceeded. History cached in-memory only.", e);
    }
  };

  const formatPlaytime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      const remMin = minutes % 60;
      return `${hours}h ${remMin}m`;
    }
    if (minutes > 0) {
      return `${minutes}m`;
    }
    return `${seconds}s`;
  };


  const listenedTracksSet = useMemo(() => {
    if (!streamingData || !streamingData.raw) return new Set<string>();
    const set = new Set<string>();
    streamingData.raw.forEach(item => {
      const track = (item.trackName || item.master_metadata_track_name || "").toLowerCase().trim();
      const artist = (item.artistName || item.master_metadata_album_artist_name || "").toLowerCase().trim();
      if (track && artist) {
        set.add(`${track} ||| ${artist}`);
      }
    });
    return set;
  }, [streamingData]);

  const isTrackListened = useCallback((title: string, artist: string) => {
    const tClean = title.toLowerCase().trim();
    const aClean = artist.toLowerCase().trim();
    return listenedTracksSet.has(`${tClean} ||| ${aClean}`);
  }, [listenedTracksSet]);

  const filteredSimilarArtists = useMemo(() => {
    if (!artistDNA || !artistDNA.similarArtists) return [];
    if (familiarityLevel === "all") return artistDNA.similarArtists;
    const minPopularity = familiarityLevel === "familiar" ? 60 : 80;
    return artistDNA.similarArtists.filter(item => (item.popularity ?? 75) >= minPopularity);
  }, [artistDNA, familiarityLevel]);

  const filteredSimilarTracks = useMemo(() => {
    if (!songDNA || !songDNA.similarTracks) return [];
    
    // 1. Tag each track with isListened status
    const baseTracks = songDNA.similarTracks.map(item => {
      const isListened = isTrackListened(item.title, item.artist);
      return { ...item, isListened };
    });

    // 2. Familiarity filter
    let filteredBase = baseTracks;
    if (familiarityLevel !== "all") {
      const minPopularity = familiarityLevel === "familiar" ? 60 : 80;
      filteredBase = baseTracks.filter(item => (item.popularity ?? 75) >= minPopularity);
    }

    // 3. Separate into undiscovered and listenedCandidates (played history)
    const undiscovered = filteredBase.filter(item => !item.isListened);
    const listenedCandidates = filteredBase.filter(item => item.isListened);

    // 4. Prioritize according to Discovery Mode and active constellationSize
    const limitSize = constellationSize;
    let selected: typeof filteredBase = [];

    if (discoveryMode === "curiosity") {
      // Curiosity prioritizes discovery: unplayed first, fallback to listened
      selected = undiscovered.slice(0, limitSize);
      if (selected.length < limitSize) {
        const needed = limitSize - selected.length;
        selected = [...selected, ...listenedCandidates.slice(0, needed)];
      }
    } else {
      // Nostalgia prioritizes played history: listened first, fallback to unplayed
      selected = listenedCandidates.slice(0, limitSize);
      if (selected.length < limitSize) {
        const needed = limitSize - selected.length;
        selected = [...selected, ...undiscovered.slice(0, needed)];
      }
    }

    // 5. Re-assign beautiful Concentric Galactic Spiral coordinates
    const positioned = selected.map((item, idx) => {
      const angle = idx * 2.3;
      const radius = 22 + idx * 2.5;
      return {
        ...item,
        x: Math.round(Math.cos(angle) * radius),
        y: Math.round(Math.sin(angle) * radius)
      };
    });

    // 6. Run overlap resolution to guarantee maximum beauty
    return resolveNodeOverlaps(positioned, 21);
  }, [songDNA, familiarityLevel, discoveryMode, constellationSize, isTrackListened]);

  useEffect(() => {
    if (activeMapType === "artist") {
      if (filteredSimilarArtists.length > 0) {
        const exists = filteredSimilarArtists.some(item => item.id === selectedArtistConstellationNode?.id);
        if (!exists) {
          setSelectedArtistConstellationNode(filteredSimilarArtists[0]);
        }
      } else {
        setSelectedArtistConstellationNode(null);
      }
    } else {
      if (filteredSimilarTracks.length > 0) {
        const exists = filteredSimilarTracks.some(item => item.id === selectedConstellationNode?.id);
        if (!exists) {
          setSelectedConstellationNode(filteredSimilarTracks[0]);
        }
      } else {
        setSelectedConstellationNode(null);
      }
    }
  }, [familiarityLevel, filteredSimilarArtists, filteredSimilarTracks, activeMapType]);


  const streamingStats = React.useMemo(() => {
    if (!streamingData || !streamingData.raw || streamingData.raw.length === 0) {
      return {
        all_time: { tracks: [], artists: [], albums: [] },
        last_6_months: { tracks: [], artists: [], albums: [] },
        last_month: { tracks: [], artists: [], albums: [] }
      };
    }

    const rawPlays = streamingData.raw;
    const refTime = streamingData.maxDate ? streamingData.maxDate.getTime() : Date.now();

    // Filter tracks by date threshold
    const getFilteredPlays = (range: "all_time" | "last_6_months" | "last_month") => {
      if (range === "all_time") return rawPlays;
      
      const days = range === "last_month" ? 30 : 180;
      const threshold = refTime - (days * 24 * 60 * 60 * 1000);
      return rawPlays.filter(item => {
        const timeStr = item.ts || item.endTime;
        if (!timeStr) return false;
        const ms = new Date(timeStr).getTime();
        return !isNaN(ms) && ms >= threshold;
      });
    };

    const computeForRange = (range: "all_time" | "last_6_months" | "last_month") => {
      const plays = getFilteredPlays(range);
      
      const trackMap = new Map<string, { name: string; artist: string; album: string; count: number; ms: number; uri: string }>();
      const artistMap = new Map<string, { name: string; count: number; ms: number }>();
      const albumMap = new Map<string, { title: string; artist: string; count: number; ms: number }>();

      const cleanString = (str: string) => {
        if (!str) return "";
        let cleaned = str.split(" - ")[0]; // remove " - Remastered" etc
        cleaned = cleaned.split(" (feat.")[0]; // remove featured artists
        cleaned = cleaned.split(" [feat.")[0];
        return cleaned.trim();
      };

      plays.forEach(item => {
        const rawTrackName = item.master_metadata_track_name || item.trackName || "";
        const rawArtistName = item.master_metadata_album_artist_name || item.artistName || "";
        const trackName = cleanString(rawTrackName);
        const artistName = cleanString(rawArtistName);
        const albumName = cleanString(item.master_metadata_album_album_name || item.albumName || "Unknown Album");
        const ms = item.ms_played !== undefined ? item.ms_played : (item.msPlayed !== undefined ? item.msPlayed : 0);
        const uri = item.spotify_track_uri || "";


        const trackKey = `${trackName.toLowerCase().trim()}:::${artistName.toLowerCase().trim()}`;
        if (trackName && artistName) {
          const existingTrack = trackMap.get(trackKey);
          if (existingTrack) {
            existingTrack.count += 1;
            existingTrack.ms += ms;
            if (!existingTrack.uri && uri) existingTrack.uri = uri;
          } else {
            trackMap.set(trackKey, { name: trackName, artist: artistName, album: albumName, count: 1, ms, uri });
          }
        }

        if (artistName) {
          const artistKey = artistName.toLowerCase().trim();
          const existingArtist = artistMap.get(artistKey);
          if (existingArtist) {
            existingArtist.count += 1;
            existingArtist.ms += ms;
          } else {
            artistMap.set(artistKey, { name: artistName, count: 1, ms });
          }
        }

        if (albumName && artistName && albumName !== "Unknown Album") {
          const albumKey = `${albumName.toLowerCase().trim()}:::${artistName.toLowerCase().trim()}`;
          const existingAlbum = albumMap.get(albumKey);
          if (existingAlbum) {
            existingAlbum.count += 1;
            existingAlbum.ms += ms;
          } else {
            albumMap.set(albumKey, { title: albumName, artist: artistName, count: 1, ms });
          }
        }
      });

      const tracksList = Array.from(trackMap.values())
        .map((t, idx) => ({
          id: `track_history_${idx}`,
          name: t.name,
          artist: t.artist,
          album: t.album,
          playCount: t.count,
          totalMs: t.ms,
          spotifyUri: t.uri,
          spotifyId: t.uri ? t.uri.split(":").pop() || "" : ""
        }))
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, 100);

      const artistsList = Array.from(artistMap.values())
        .map((a, idx) => ({
          id: `artist_history_${idx}`,
          name: a.name,
          playCount: a.count,
          totalMs: a.ms
        }))
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, 100);

      const albumsList = Array.from(albumMap.values())
        .map((al, idx) => ({
          id: `album_history_${idx}`,
          name: al.title,
          artist: al.artist,
          playCount: al.count,
          totalMs: al.ms
        }))
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, 100);

      return { tracks: tracksList, artists: artistsList, albums: albumsList };
    };

    return {
      all_time: computeForRange("all_time"),
      last_6_months: computeForRange("last_6_months"),
      last_month: computeForRange("last_month")
    };
  }, [streamingData]);

  const displayedStreamingStats = React.useMemo(() => {
    const rangeData = streamingStats[streamingRange] || { tracks: [], artists: [], albums: [] };
    const categoryData = rangeData[streamingCategory] || [];

    if (!streamingSearch.trim()) {
      return categoryData;
    }

    const query = streamingSearch.toLowerCase().trim();
    return categoryData.filter((item: any) => {
      const matchName = item.name.toLowerCase().includes(query);
      const matchArtist = item.artist ? item.artist.toLowerCase().includes(query) : false;
      return matchName || matchArtist;
    });
  }, [streamingStats, streamingRange, streamingCategory, streamingSearch]);



  const setConstellationSize = (size: number) => {
    if (mapEngine === "gemini") {
      setConstellationSizeAI(size);
    } else {
      setConstellationSizeAPI(size);
    }
  };

  // Audio Preview state
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Send a single request to ListenBrainz lookup when a MusicMap (Artist or Song DNA) is loaded
  useEffect(() => {
    const triggerListenBrainzLookup = async () => {
      const urls: string[] = [];
      const isArtist = activeMapType === "artist";

      if (isArtist && filteredSimilarArtists) {
        filteredSimilarArtists.forEach(node => {
          if (node.id && /^[a-zA-Z0-9]{22}$/.test(node.id)) {
            urls.push(`https://open.spotify.com/artist/${node.id}`);
          }
        });
      } else if (!isArtist && filteredSimilarTracks) {
        filteredSimilarTracks.forEach(node => {
          if (node.id && /^[a-zA-Z0-9]{22}$/.test(node.id)) {
            urls.push(`https://open.spotify.com/track/${node.id}`);
          }
        });
      }

      if (urls.length === 0) return;

      console.log(`[LISTENBRAINZ BATCH] Identified ${urls.length} Spotify ${isArtist ? "artist" : "track"} URLs on the active music map. Submitting in a single request to ListenBrainz...`);
      try {
        const response = await fetch("/api/listenbrainz/lookup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ urls: urls.slice(0, 50) }) // Limit to 50 as described in prompt
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`[LISTENBRAINZ BATCH] SUCCESS: Successfully completed ListenBrainz urls2msids bulk lookup for ${urls.length} nodes on music map.`, data);
        } else {
          console.error(`[LISTENBRAINZ BATCH] ERROR: ListenBrainz bulk lookup endpoint returned status ${response.status}`);
        }
      } catch (err) {
        console.error("[LISTENBRAINZ BATCH] ERROR: Exception during ListenBrainz bulk lookup fetch:", err);
      }
    };

    triggerListenBrainzLookup();
  }, [artistDNAState, songDNAState, activeMapType]);

  // Progressive loader index
  const [loaderMessage, setLoaderMessage] = useState(STAGE_MESSAGES[0]);

  // Handle wheel zoom events callback (used by callback ref to bypass React rendering lag)
  const handleWheelEvent = React.useCallback((e: WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 0.08;
    const direction = e.deltaY < 0 ? 1 : -1;
    setMapZoom(prev => {
      const newZoom = prev + direction * zoomFactor;
      return Math.max(0.4, Math.min(newZoom, 4.0));
    });
  }, []);

  const setCanvasRef = React.useCallback((node: HTMLDivElement | null) => {
    if (constellationCanvasRef.current) {
      constellationCanvasRef.current.removeEventListener('wheel', handleWheelEvent);
    }
    constellationCanvasRef.current = node;
    if (node) {
      node.addEventListener('wheel', handleWheelEvent, { passive: false });
    }
  }, [handleWheelEvent]);

  // Click & drag to pan the constellation map
  const handleMapMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    
    // Check if clicking elements that should handle direct interaction first
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return;
    }

    setIsDraggingMap(true);
    mapDragStart.current = { x: e.clientX, y: e.clientY };
    mapOffsetStart.current = { ...mapOffset };
  };

  const handleMapMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingMap) return;
    const dx = e.clientX - mapDragStart.current.x;
    const dy = e.clientY - mapDragStart.current.y;
    setMapOffset({
      x: mapOffsetStart.current.x + dx,
      y: mapOffsetStart.current.y + dy
    });
  };

  const handleMapMouseUpOrLeave = () => {
    setIsDraggingMap(false);
  };

  // OAuth Listener and Polling Sync Fallback
  useEffect(() => {
    // 1. Message-based handler (immediate if postMessage works)
    const handleOAuthMessage = (event: MessageEvent) => {
      // Validate host origins for reliability
      if (!event.origin.endsWith(".run.app") && !event.origin.includes("localhost")) {
        return;
      }
      
      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        const { accessToken: token, refreshToken: refresh, expiresIn } = event.data;
        const expiryTime = Date.now() + expiresIn * 1000;

        localStorage.setItem("spotify_access_token", token);
        localStorage.setItem("spotify_refresh_token", refresh || "");
        localStorage.setItem("spotify_expires_at", String(expiryTime));

        setAccessToken(token);
        setRefreshToken(refresh);
        setExpiresAt(expiryTime);
        setIsSandbox(false);
      }
    };

    window.addEventListener("message", handleOAuthMessage);

    // 2. LocalStorage Polling sync (fallback for popup sandbox / no-opener environments)
    const checkStorageKeys = () => {
      const token = localStorage.getItem("spotify_access_token");
      const refresh = localStorage.getItem("spotify_refresh_token");
      const expires = localStorage.getItem("spotify_expires_at");

      if (token && token !== accessToken) {
        setAccessToken(token);
        setRefreshToken(refresh);
        setExpiresAt(Number(expires || "0"));
        setIsSandbox(false);
      }
    };

    const interval = setInterval(checkStorageKeys, 1000);

    // Also listen to StorageEvent across other frames / same origin contexts
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "spotify_access_token" && e.newValue) {
        checkStorageKeys();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("message", handleOAuthMessage);
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [accessToken]);

  // Timer interval for progressive message shifts on loading state
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isDNALoading || isArtistDNALoading) {
      let idx = 0;
      interval = setInterval(() => {
        idx = (idx + 1) % STAGE_MESSAGES.length;
        setLoaderMessage(STAGE_MESSAGES[idx]);
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isDNALoading, isArtistDNALoading]);

  // Support pressing escape key to exit fullscreen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreenMap(false);
      }
    };
    if (isFullscreenMap) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreenMap]);




  // ---------------------------------------------------------
  // FIREBASE SECURITY & PLAYGROUND INTEGRATION (Pillar 691)
  // ---------------------------------------------------------

  // 1. Offline Auth simulation (always resolved)
  useEffect(() => {
    setFbUser({ uid: "local_user", displayName: "Guest Voyager" });
    setIsFbLoading(false);
  }, []);

  // 3. Image Caching logic for Artists (Proxied to server to bypass client-side ad-blockers)
  const getCachedOrFreshArtistImage = async (name: string, fallbackUrl: string, freshToken: string | null): Promise<string> => {
    const cleanId = name.replace(/[^a-zA-Z0-9_\-]/g, "_").toLowerCase().substring(0, 100);
    if (!cleanId) return fallbackUrl;

    try {
      const res = await fetch(`/api/cache/image?id=${cleanId}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.imageUrl && data.imageUrl.startsWith("http")) {
          return data.imageUrl;
        }
      }
    } catch (err) {
      console.warn("Firestore cache image read issue:", err);
    }

    let imageUrl = fallbackUrl;
    try {
      const searchRes = await fetch(`/api/artist/image?artist=${encodeURIComponent(name)}`);
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData?.imageUrl) {
          imageUrl = searchData.imageUrl;

          // Cache it globally via server endpoint
          try {
            console.log(`[CLIENT CACHE TRIGGER] Attempting to cache Artist image to Firestore via server. ID: "${cleanId}", URL: "${imageUrl}"`);
            const cacheResponse = await fetch("/api/cache/image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: cleanId, imageUrl })
            });
            if (cacheResponse.ok) {
              console.log(`[CLIENT CACHE TRIGGER] Server reported successful write of Artist "${cleanId}".`);
            }
          } catch (cacheWriteErr) {
            console.warn("Firestore cache image writing skipped or failed:", cacheWriteErr);
          }
        }
      }
    } catch (err) {
      console.warn("Deezer lookup failed for artist image:", err);
    }
    return imageUrl;
  };

  // 4. Image Caching logic for Tracks (Proxied to server to bypass client-side ad-blockers)
  const getCachedOrFreshTrackImage = async (title: string, artist: string, fallbackUrl: string, freshToken: string | null): Promise<string> => {
    const fullQuery = `${title} ${artist}`;
    const cleanId = fullQuery.replace(/[^a-zA-Z0-9_\-]/g, "_").toLowerCase().substring(0, 100);
    if (!cleanId) return fallbackUrl;

    try {
      const res = await fetch(`/api/cache/image?id=${cleanId}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.imageUrl && data.imageUrl.startsWith("http")) {
          return data.imageUrl;
        }
      }
    } catch (err) {
      console.warn("Firestore track cache image read issue:", err);
    }

    let imageUrl = fallbackUrl;
    try {
      const sRes = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(fullQuery)}&limit=1&media=music`
      );
      if (sRes.ok) {
        const sData = await sRes.json();
        const trackItem = sData.results?.[0];
        if (trackItem?.artworkUrl100) {
          imageUrl = trackItem.artworkUrl100.replace("100x100bb", "400x400bb") || fallbackUrl;

          // Cache it globally via server endpoint
          try {
            console.log(`[CLIENT CACHE TRIGGER] Attempting to cache Track image to Firestore via server. ID: "${cleanId}", URL: "${imageUrl}"`);
            const cacheResponse = await fetch("/api/cache/image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: cleanId, imageUrl })
            });
            if (cacheResponse.ok) {
              console.log(`[CLIENT CACHE TRIGGER] Server reported successful write of Track "${cleanId}".`);
            }
          } catch (cacheWriteErr) {
            console.warn("Firestore cache image writing skipped or failed:", cacheWriteErr);
          }
        }
      }
    } catch (err) {
      console.warn("iTunes lookup failed for track image:", err);
    }
    return imageUrl;
  };

  // 5. Save active constellation map to Favorites (Saves locally)
  const saveActiveMapToFavorites = async () => {
    const isArtist = activeMapType === "artist";
    const name = isArtist ? artistDNA?.name : songDNA?.name;
    if (!name) return;

    setIsSavingFav(true);
    const id = name.replace(/[^a-zA-Z0-9_\-]/g, "_").toLowerCase().substring(0, 100);

    try {
      const nodes = isArtist ? filteredSimilarArtists : filteredSimilarTracks;
      
      const payload: any = {
        favId: id,
        id: id,
        userId: "local_user",
        name: name,
        type: activeMapType,
        nodes: nodes || [],
        createdAt: new Date().toISOString()
      };

      if (!isArtist) {
        payload.artist = selectedTrack?.artists?.[0]?.name || songDNA?.artist || "";
        payload.metrics = songDNA?.metrics || null;
      } else {
        payload.description = artistDNA?.description || "";
      }

      setFbFavorites(prev => {
        const next = prev.filter(f => f.favId !== id);
        const updated = [...next, payload];
        localStorage.setItem("starDNA_favorites", JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      console.error("[FAVORITES SAVE ERROR]:", err);
    } finally {
      setIsSavingFav(false);
    }
  };

  // 6. Delete constellation map from Favorites (Deletes locally)
  const removeMapFromFavorites = async (name: string) => {
    const id = name.replace(/[^a-zA-Z0-9_\-]/g, "_").toLowerCase().substring(0, 100);
    setIsSavingFav(true);
    try {
      setFbFavorites(prev => {
        const updated = prev.filter(f => f.favId !== id);
        localStorage.setItem("starDNA_favorites", JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      console.error("[FAVORITES DELETE ERROR]:", err);
    } finally {
      setIsSavingFav(false);
    }
  };


  // Token verify & refresh logic before API invocations
  const ensureValidToken = async (): Promise<string | null> => {
    if (isSandbox) return null;
    if (!accessToken) return null;

    // Check if token expires in less than 5 minutes
    if (Date.now() > expiresAt - 300000 && refreshToken) {
      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken })
        });

        if (!res.ok) throw new Error("Could not refresh session token");
        
        const data = await res.json();
        const nextExpiry = Date.now() + data.expiresIn * 1000;

        localStorage.setItem("spotify_access_token", data.accessToken);
        setAccessToken(data.accessToken);
        
        if (data.refreshToken) {
          localStorage.setItem("spotify_refresh_token", data.refreshToken);
          setRefreshToken(data.refreshToken);
        }
        localStorage.setItem("spotify_expires_at", String(nextExpiry));
        setExpiresAt(nextExpiry);

        return data.accessToken;
      } catch (err) {
        console.error("Token verification failed, reverting to sandbox state:", err);
        handleSignOut();
        return null;
      }
    }
    return accessToken;
  };

  // Helper to retrieve either a user token or a general-purpose public token from the server
  const getGeneralToken = async (): Promise<string | null> => {
    // Try logged-in user token first
    const userToken = await ensureValidToken();
    if (userToken) return userToken;

    // Direct fallback to server's public Client Credentials search token
    try {
      const res = await fetch("/api/spotify/token");
      if (res.ok) {
        const data = await res.json();
        return data.accessToken || null;
      }
    } catch (e) {
      console.warn("Public token fetching failed:", e);
    }
    return null;
  };

  // Profile fetching from Spotify
  useEffect(() => {
    if (isSandbox) {
      setUserProfile({
        id: "sandbox_pilot",
        display_name: "Explorer Sandbox"
      });
      return;
    }

    const fetchUserProfile = async () => {
      setIsProfileLoading(true);
      const token = await ensureValidToken();
      if (!token) return;

      try {
        const response = await fetch("https://api.spotify.com/v1/me", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.status === 401) {
          handleSignOut();
          return;
        }
        if (!response.ok) throw new Error("Could not fetch user profile");
        const profileInstance = await response.json();
        setUserProfile(profileInstance);
      } catch (error) {
        console.error("Profile retrieval issue:", error);
      } finally {
        setIsProfileLoading(false);
      }
    };

    fetchUserProfile();
  }, [accessToken, isSandbox]);

  // Top Tracks loading
  useEffect(() => {
    if (isSandbox) {
      if (topRange === "short_term") {
        setTopTracks(DEMO_SHORT_TERM_TRACKS);
      } else if (topRange === "medium_term") {
        setTopTracks(DEMO_MEDIUM_TERM_TRACKS);
      } else {
        setTopTracks(DEMO_LONG_TERM_TRACKS);
      }
      return;
    }

    const fetchTopPlayedTracks = async () => {
      setIsTracklistLoading(true);
      const token = await ensureValidToken();
      if (!token) return;

      try {
        const response = await fetch(
          `https://api.spotify.com/v1/me/top/tracks?time_range=${topRange}&limit=30`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.status === 401) {
          handleSignOut();
          return;
        }
        if (!response.ok) throw new Error("Could not fetch top tracks history");
        const parsed = await response.json();
        setTopTracks(parsed.items || []);
      } catch (err) {
        console.error("Top tracks loading failed:", err);
      } finally {
        setIsTracklistLoading(false);
      }
    };

    fetchTopPlayedTracks();
  }, [accessToken, topRange, isSandbox]);

  // Search logic
  useEffect(() => {
    const handleSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      setIsTracklistLoading(true);

      // 1. Instant client-side search matching local demo assets
      const combinedSandbox = [
        ...DEMO_SHORT_TERM_TRACKS,
        ...DEMO_MEDIUM_TERM_TRACKS,
        ...DEMO_LONG_TERM_TRACKS
      ];
      // Deduplicate sandbox by name + artist
      const uniqueSandbox: SpotifyTrack[] = [];
      const seenLocal = new Set<string>();
      for (const item of combinedSandbox) {
        const key = `${item.name.toLowerCase()}-${item.artists[0]?.name.toLowerCase()}`;
        if (!seenLocal.has(key)) {
          seenLocal.add(key);
          uniqueSandbox.push(item);
        }
      }

      const normalized = searchQuery.toLowerCase();
      const filteredLocal = uniqueSandbox.filter(
        item => item.name.toLowerCase().includes(normalized) || 
                item.artists[0].name.toLowerCase().includes(normalized)
      );

      // Results collections to merge
      let lastfmResults: SpotifyTrack[] = [];
      let iTunesResults: SpotifyTrack[] = [];

      // Run multiple search sources in parallel to drastically improve speed
      const lastfmPromise = fetch(`/api/lastfm/search?q=${encodeURIComponent(searchQuery)}`)
        .then(res => res.ok ? res.json() : null)
        .catch(err => {
          console.warn("[LASTFM AUTOCONNECT SEARCH ERROR] Failed to fetch Last.fm autocomplete results:", err);
          return null;
        });

      // Query standard songs and release items
      const itunesSongsPromise = fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&limit=15&media=music`)
        .then(res => res.ok ? res.json() : null)
        .catch(err => {
          console.warn("[ITUNES SONG SEARCH FALLBACK] Failed to reach iTunes:", err);
          return null;
        });

      // Query artists specifically so we have full unified support for direct artist discovery
      const itunesArtistsPromise = fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&limit=10&media=music&entity=musicArtist`)
        .then(res => res.ok ? res.json() : null)
        .catch(err => {
          console.warn("[ITUNES ARTIST SEARCH FALLBACK] Failed to reach iTunes:", err);
          return null;
        });

      const [lastfmData, iTunesSongsData, iTunesArtistsData] = await Promise.all([
        lastfmPromise,
        itunesSongsPromise,
        itunesArtistsPromise
      ]);

      if (lastfmData) {
        const lTracks = lastfmData.tracks || [];
        const lArtists = lastfmData.artists || [];

        const lastfmTracksMapped = lTracks.map((item: any, idx: number) => {
          const imageUrl = item.image?.[2]?.["#text"] || item.image?.[1]?.["#text"] || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=150&h=150&fit=crop";
          return {
            id: item.mbid || `lastfm_track_${idx}_${Math.random().toString(36).substring(2, 7)}`,
            name: item.name || "Unknown Track",
            artists: [{
              id: `lastfm_art_${idx}`,
              name: item.artist || "Unknown Artist"
            }],
            album: {
              id: `lastfm_alb_track_${idx}`,
              name: "Release Info",
              images: [{ url: imageUrl, height: 100, width: 100 }],
              release_date: "2026"
            },
            duration_ms: 180000,
            popularity: 80,
            preview_url: null,
            external_urls: { spotify: item.url || "" },
            uri: `spotify:track:${item.mbid || idx}`
          };
        });

        const lastfmArtistsMapped = lArtists.map((item: any, idx: number) => {
          const imageUrl = item.image?.[2]?.["#text"] || item.image?.[1]?.["#text"] || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&h=150&fit=crop";
          return {
            id: item.mbid || `lastfm_artist_${idx}_${Math.random().toString(36).substring(2, 7)}`,
            name: item.name || "Unknown Artist",
            artists: [{
              id: item.mbid || `lastfm_art_${idx}`,
              name: item.name || "Unknown Artist"
            }],
            album: {
              id: `lastfm_alb_art_${idx}`,
              name: "Artist Profile",
              images: [{ url: imageUrl, height: 100, width: 100 }],
              release_date: ""
            },
            duration_ms: 0,
            popularity: 85,
            preview_url: null,
            external_urls: { spotify: item.url || "" },
            uri: `spotify:artist:${item.mbid || idx}`
          };
        });

        lastfmResults = [...lastfmTracksMapped, ...lastfmArtistsMapped];
      }

      // Merge both iTunes artists and tracks/songs results
      const itunesCombinedResults = [
        ...(iTunesArtistsData?.results || []),
        ...(iTunesSongsData?.results || [])
      ];

      if (itunesCombinedResults.length > 0) {
        iTunesResults = itunesCombinedResults.map((item: any, idx: number) => {
          const isArtist = item.wrapperType === "artist" || item.artistType === "Artist" || item.kind === "music-artist";
          return {
            id: String(item.trackId || item.artistId || `itunes_${idx}_${Math.random()}`),
            name: item.trackName || item.artistName || "Unknown Music",
            artists: [{
              id: String(item.artistId || `itunes_art_${idx}`),
              name: item.artistName || "Unknown Artist"
            }],
            album: {
              id: String(item.collectionId || `itunes_col_${idx}`),
              name: isArtist ? "Artist Profile" : item.collectionName || "Single Release",
              images: [{
                url: item.artworkUrl100 || (isArtist 
                  ? "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&h=150&fit=crop"
                  : "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=150&h=150&fit=crop"),
                height: 100,
                width: 100
              }],
              release_date: item.releaseDate ? item.releaseDate.substring(0, 4) : "2026"
            },
            duration_ms: item.trackTimeMillis || 180000,
            popularity: 75,
            preview_url: item.previewUrl || null,
            external_urls: { spotify: item.trackViewUrl || item.artistViewUrl || "" },
            uri: isArtist ? `spotify:artist:${item.artistId || idx}` : `spotify:track:${item.trackId || idx}`
          };
        });
      }

      // Merge and prioritize local -> Last.fm Autocomplete -> iTunes Autocomplete
      const merged = [...filteredLocal, ...lastfmResults, ...iTunesResults];
      const finalMerged: SpotifyTrack[] = [];
      const seenIds = new Set<string>();
      
      for (const tr of merged) {
        // Dedup by lowercase track/artist name combination
        const matchKey = `${tr.name.toLowerCase()}--${tr.artists[0]?.name.toLowerCase()}`;
        if (!seenIds.has(matchKey)) {
          seenIds.add(matchKey);
          finalMerged.push(tr);
        }
      }

      if (finalMerged.length === 0) {
        setSearchResults([
          {
            id: "custom_type",
            name: searchQuery,
            artists: [{ id: "custom_art", name: "Custom Subject" }],
            album: {
              id: "custom_alb",
              name: "Custom Search Result",
              images: [{ url: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=150&h=150&fit=crop", height: 150, width: 150 }],
              release_date: "2026"
            },
            duration_ms: 180000,
            popularity: 50,
            preview_url: null,
            external_urls: { spotify: "" },
            uri: ""
          }
        ]);
        setIsTracklistLoading(false);
      } else {
        // Partition and sort the final duplicate-free list:
        // 1. Direct spelling matching Artists
        // 2. Music/Song Tracks
        // 3. Other/Non-matching Artists
        const qClean = searchQuery.toLowerCase().trim();
        const directArtistMatches: SpotifyTrack[] = [];
        const songMatches: SpotifyTrack[] = [];
        const otherArtistMatches: SpotifyTrack[] = [];

        for (const track of finalMerged) {
          const isArtist = track.album?.name === "Artist Profile" || track.uri?.includes(":artist:");
          if (isArtist) {
            if (track.name.toLowerCase().trim() === qClean) {
              directArtistMatches.push(track);
            } else {
              otherArtistMatches.push(track);
            }
          } else {
            songMatches.push(track);
          }
        }

        const sortedResults = [
          ...directArtistMatches,
          ...songMatches,
          ...otherArtistMatches
        ];

        const topResults = sortedResults.slice(0, 20);
        setSearchResults(topResults);
        setIsTracklistLoading(false);

        // Asynchronously enrich any results that have generic placeholder/fallback artwork
        const enrichments = topResults.map(async (track) => {
          const firstImage = track.album?.images?.[0]?.url;
          const isPlaceholder = isPlaceholderImage(firstImage);
          
          if (isPlaceholder) {
            try {
              const isArtist = track.album?.name === "Artist Profile" || track.uri?.includes(":artist:");
              
              if (isArtist) {
                // Fetch high-fidelity artist photo via local server-side Deezer proxy route
                const res = await fetch(`/api/artist/image?artist=${encodeURIComponent(track.name)}`);
                if (res.ok) {
                  const data = await res.json();
                  if (data && data.imageUrl) {
                    return {
                      ...track,
                      album: {
                        ...track.album,
                        images: [{ url: data.imageUrl, height: 200, width: 200 }]
                      }
                    };
                  }
                }
              } else {
                // Fetch track image via iTunes search
                const searchQueryTerm = `${track.name} ${track.artists?.[0]?.name || ""}`;
                const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchQueryTerm.trim())}&limit=1&media=music`);
                if (res.ok) {
                  const data = await res.json();
                  if (data.results && data.results.length > 0) {
                    const artwork = data.results[0].artworkUrl100?.replace("100x100bb", "200x200bb");
                    if (artwork) {
                      return {
                        ...track,
                        album: {
                          ...track.album,
                          images: [{ url: artwork, height: 200, width: 200 }]
                        }
                      };
                    }
                  }
                }
              }
            } catch (err) {
              console.warn("[ITUNES/PROXY SEARCH RESULT ENRICHMENT FAIL]:", err);
            }
          }
          return track;
        });

        Promise.all(enrichments).then((enriched) => {
          setSearchResults(enriched);
        });
      }
    };

    const delayDebounce = setTimeout(() => {
      handleSearch();
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, isSandbox]);

  // Auxiliary helpers for real Spotify keys
  const getSpotifyKeyName = (key: number, mode: number) => {
    const keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    if (key < 0 || key >= 12) return "";
    return `${keys[key]} ${mode === 1 ? "Major" : "Minor"}`;
  };

  // Stable musicological profile traits for artists
  const getArtistStyleMetrics = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const ratio1 = Math.abs((hash * 13) % 61) + 30; // 30-91%
    const ratio2 = Math.abs((hash * 17) % 53) + 35; // 35-88%
    const ratio3 = Math.abs((hash * 23) % 47) + 25; // 25-72%
    const ratio4 = Math.abs((hash * 29) % 39) + 40; // 40-79%
    return {
      intensity: ratio1,
      experimentalism: ratio2,
      brightness: ratio3,
      rhythm: ratio4
    };
  };


  // Generate beautiful, high-fidelity mock recommendation coordinates for Spotify Engine fallback/sandbox
  const generateSpotifySandboxMock = (track: SpotifyTrack, activeSize: number, prefix: string = "") => {
    const combinedDemo = [
      ...DEMO_SHORT_TERM_TRACKS,
      ...DEMO_MEDIUM_TERM_TRACKS,
      ...DEMO_LONG_TERM_TRACKS
    ];
    // Pick unique random items up to activeSize
    const shuffled = [...combinedDemo].sort(() => 0.5 - Math.random());
    const selectedRecs = shuffled.slice(0, activeSize);

    const seedEnergy = 0.5 + Math.random() * 0.4;
    const seedValence = 0.4 + Math.random() * 0.5;

    const similarTracks = selectedRecs.map((recTrack, index) => {
      const energyOffset = (Math.random() - 0.5) * 0.6;
      const valenceOffset = (Math.random() - 0.5) * 0.6;
      const energy = Math.min(1, Math.max(0, seedEnergy + energyOffset));
      const valence = Math.min(1, Math.max(0, seedValence + valenceOffset));

      const xVal = Math.min(100, Math.max(-100, Math.round((energy - seedEnergy) * 150)));
      const yVal = Math.min(100, Math.max(-100, Math.round((valence - seedValence) * 150)));

      const dist = Math.sqrt(Math.pow(energy - seedEnergy, 2) + Math.pow(valence - seedValence, 2));
      const similarityScore = Math.max(10, Math.round(100 - (dist * 100)));

      return {
        id: recTrack.id + "_" + index,
        title: recTrack.name,
        artist: recTrack.artists.map(a => a.name).join(", "),
        similarityScore,
        explanation: `Acoustic Match: Standard electronic/analog signals place this track inside a premium complementary frequency range of the central subject.`,
        x: xVal,
        y: yVal,
        category: similarityScore > 80 ? "Harmonic Cousin" : similarityScore > 60 ? "Sonic Twin" : "Vibe Anchor",
        preview_url: recTrack.preview_url,
        external_urls: recTrack.external_urls,
        imageUrl: recTrack.album?.images?.[1]?.url || recTrack.album?.images?.[0]?.url || ""
      };
    });

    const data: SongDNA = {
      name: track.name,
      artist: track.artists.map(a => a.name).join(", "),
      genres: ["Pop", "Indie", "Discovery"],
      description: prefix 
        ? `${prefix}Using local cached lists to simulate acoustic signatures.`
        : `Simulating Spotify Core Engine (Sandbox Preview Mode). Connect your actual Spotify credentials using the button on the left panel to use real acoustic signatures!`,
      metrics: {
        energy: Math.round(seedEnergy * 100),
        valence: Math.round(seedValence * 100),
        acousticness: Math.round(Math.random() * 60 + 10),
        danceability: Math.round(Math.random() * 60 + 20),
        tempo: Math.round(Math.random() * 45 + 100),
        vocalPresence: Math.round(Math.random() * 50 + 20),
        complexity: Math.round(Math.random() * 50 + 30)
      },
      similarTracks
    };

    setSongDNA(data);
    if (data.similarTracks?.length > 0) {
      setSelectedConstellationNode(data.similarTracks[0]);
    }
  };

  // Bulk enrichment helper for artists using high-contrast category images
  const enrichArtistsInBulk = async (artists: ArtistConnectionNode[]): Promise<ArtistConnectionNode[]> => {
    const enrichments = artists.map(async (node, index) => {
      if (node.imageUrl && !isPlaceholderImage(node.imageUrl)) return node;

      // Try searching Deezer API first for artist's official portrait!
      try {
        const query = node.name.trim();
        const res = await fetch(`/api/artist/image?artist=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.imageUrl) {
            return { ...node, imageUrl: data.imageUrl };
          }
        }
      } catch (err) {
        console.warn("[DEEZER ARTIST BULK ENRICHMENT FAIL]:", err);
      }

      // Fallback: Try searching iTunes API for artist's release artwork!
      try {
        const query = node.name.trim();
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&limit=1&media=music`);
        if (res.ok) {
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            const artwork = data.results[0].artworkUrl100?.replace("100x100bb", "200x200bb");
            if (artwork) {
              return { ...node, imageUrl: artwork };
            }
          }
        }
      } catch (err) {
        console.warn("[ITUNES ARTIST BULK ENRICHMENT FAIL]:", err);
      }

      const fallbackUrl = ARTIST_MOCK_IMAGES[index % ARTIST_MOCK_IMAGES.length];
      return { ...node, imageUrl: fallbackUrl };
    });

    return Promise.all(enrichments);
  };

  // Bulk enrichment helper for tracks using high-contrast catalog images
  const enrichTracksInBulk = async (tracks: ConnectionNode[]): Promise<ConnectionNode[]> => {
    const TRACK_MOCK_IMAGES = [
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=150&h=150&fit=crop", // Concert
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=150&h=150&fit=crop", // DJs Soundboard
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&h=150&fit=crop", // Microphones
      "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=150&h=150&fit=crop", // Electric Bass guitar
      "https://images.unsplash.com/photo-1487180142328-054b783fc471?w=150&h=150&fit=crop", // Turntable / Vinyl Record
      "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=150&h=150&fit=crop", // Retro Speakers
      "https://images.unsplash.com/photo-1516280440614-37939bbacd6a?w=150&h=150&fit=crop", // Acoustic Studio Live
      "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=150&h=150&fit=crop", // Soundboard Neon
      "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=150&h=150&fit=crop", // Atmospheric Stage
      "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=150&h=150&fit=crop"  // Vintage Tape Deck
    ];

    const enrichments = tracks.map(async (node, index) => {
      if (node.imageUrl && !isPlaceholderImage(node.imageUrl)) return node;

      // Limit active iTunes requests to first 35 tracks to avoid API rate-limiting and stay snappy
      if (index >= 35) {
        const fallbackUrl = TRACK_MOCK_IMAGES[index % TRACK_MOCK_IMAGES.length];
        return { ...node, imageUrl: fallbackUrl };
      }

      // Try searching iTunes API for real album cover art!
      try {
        const query = `${node.title} ${node.artist}`.trim();
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&limit=1&media=music`);
        if (res.ok) {
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            const artwork = data.results[0].artworkUrl100?.replace("100x100bb", "200x200bb");
            if (artwork) {
              return { ...node, imageUrl: artwork };
            }
          }
        }
      } catch (err) {
        console.warn("[ITUNES TRACK BULK ENRICHMENT FAIL]:", err);
      }

      // Fallback to randomized high-quality mock images
      const fallbackUrl = TRACK_MOCK_IMAGES[index % TRACK_MOCK_IMAGES.length];
      return { ...node, imageUrl: fallbackUrl };
    });

    return Promise.all(enrichments);
  };

  const addToRecentSearches = (item: {name: string, artist?: string, id: string, image?: string, isArtist?: boolean}) => {
    setRecentSearches(prev => {
      const filtered = prev.filter(t => t.name !== item.name); // basic dupe prevention
      const newArr = [item, ...filtered].slice(0, 10);
      localStorage.setItem("beat_browser_recent_searches", JSON.stringify(newArr));
      return newArr;
    });
  };

  // Call backend or Spotify to map Artist Space
  const generateArtistDNA = async (artistName: string, sizeOverride?: number, engineOverride?: "gemini" | "spotify") => {
    setIsArtistDNALoading(true);
    setDnaError(null);
    setArtistDNA(null);
    setSelectedArtistConstellationNode(null);
    setActiveMapType("artist");

    const activeSize = sizeOverride !== undefined ? sizeOverride : constellationSize;

    try {
      // 1. Fetch similar artists instantly from Last.fm
      const lastfmRes = await fetch(`/api/lastfm/similar-artists?artist=${encodeURIComponent(artistName)}&limit=${activeSize}`);
      let similarArtists = await lastfmRes.json();
      
      if (similarArtists) {
         similarArtists = await enrichArtistsInBulk(similarArtists);
      } else {
         similarArtists = [];
      }

      // Try fetching active artist's artwork from Deezer first
      let artistImageUrl: string | undefined = undefined;
      try {
        const query = artistName.trim();
        const deezerRes = await fetch(`/api/artist/image?artist=${encodeURIComponent(query)}`);
        if (deezerRes.ok) {
          const data = await deezerRes.json();
          if (data.imageUrl) {
            artistImageUrl = data.imageUrl;
          }
        }
      } catch (err) {
        console.warn("[DEEZER ACTIVE ARTIST IMAGE FAIL]:", err);
      }

      if (!artistImageUrl) {
        if (selectedTrack && selectedTrack.artists?.some(a => a.name.toLowerCase() === artistName.toLowerCase())) {
          artistImageUrl = selectedTrack.album?.images?.[0]?.url;
        }
      }

      if (!artistImageUrl) {
        try {
          const query = artistName.trim();
          const itunesRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&limit=1&media=music`);
          if (itunesRes.ok) {
            const data = await itunesRes.json();
            if (data.results && data.results.length > 0) {
              artistImageUrl = data.results[0].artworkUrl100?.replace("100x100bb", "400x400bb");
            }
          }
        } catch (err) {
          console.warn("[ITUNES ACTIVE ARTIST IMAGE FAIL]:", err);
        }
      }

      const initData: ArtistDNA = {
        name: artistName,
        genres: [],
        description: "Streaming AI reasoning...",
        similarArtists,
        imageUrl: artistImageUrl
      };

      setArtistDNA(initData);
      setIsArtistDNALoading(false); // Map loads instantly

      if (similarArtists?.length > 0) {
        setSelectedArtistConstellationNode(similarArtists[0]);
      }

      // 2. Stream the LLM reasoning to explain "why" into the sidebar description
      const streamRes = await fetch("/api/gemini/explain-artist-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           artistName,
           similarArtists: similarArtists.slice(0, 10).map((a: any) => a.name)
        })
      });

      if (streamRes.body) {
        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder();
        let fullDescription = "";
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const messages = chunk.split('\\n\\n');
          for (const msg of messages) {
             if (msg.startsWith('data: ')) {
               try {
                 const json = JSON.parse(msg.replace('data: ', ''));
                 if (json.text) {
                   fullDescription += json.text;
                   setArtistDNA(prev => prev ? ({ ...prev, description: fullDescription }) : prev);
                 }
               } catch(e){}
             }
          }
        }
      }

    } catch (err: any) {
      console.error(err);
      setIsArtistDNALoading(false);
      setDnaError(err.message || "An error occurred while building the Artist Music Map.");
    }
  };

  // Fetches detailed artist discography catalogs from our intelligent proxy
  const loadDiscography = async (artistName: string) => {
    setIsDiscographyLoading(true);
    setDiscographyError(null);
    setIsDiscographyOpen(true);
    setActiveDiscography(null);
    try {
      const res = await fetch("/api/artist/discography", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistName })
      });
      if (!res.ok) {
        throw new Error("Failed to load official discography analysis");
      }
      const data: ArtistDiscography = await res.json();
      setActiveDiscography(data);
    } catch (err: any) {
      console.error(err);
      setDiscographyError(err.message || "An error occurred fetching the discography catalog.");
    } finally {
      setIsDiscographyLoading(false);
    }
  };

  // Processes multi-file selections of Spotify, Apple Music, YouTube Music, Amazon Music, or Tidal streaming history files
  const handleStreamingFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsParsingStreaming(true);
    setStreamingParseError(null);
    setStreamingFilesCount(files.length);

    // Standardizer helper map for versatile ingestion schemas (Spotify, Apple Music, YouTube watch-history, Amazon Music, Tidal)
    const standardizeRecord = (item: any): any | null => {
      if (!item || typeof item !== "object") return null;

      let trackName = "";
      let artistName = "";
      let albumName = "Unknown Album";
      let ts = "";
      let msPlayed = 180000; // default 3 minutes
      let service = "unknown";

      // 1. Detect YouTube / YouTube Music watch-history structure
      const isYouTube = 
        item.header === "YouTube Music" || 
        item.header === "YouTube" || 
        (Array.isArray(item.products) && (item.products.includes("YouTube") || item.products.includes("YouTube Music"))) ||
        item.titleUrl !== undefined ||
        item.subtitles !== undefined;

      if (isYouTube) {
        service = item.header === "YouTube Music" || (Array.isArray(item.products) && item.products.includes("YouTube Music")) ? "youtube_music" : "youtube";
        
        // Title of item
        let titleRaw = item.title || "";
        if (titleRaw.startsWith("Watched ")) {
          titleRaw = titleRaw.substring(8);
        }
        
        // Clean trailing youtube details like (Official Video), (Lyrics)
        let cleanTitle = titleRaw
          .replace(/\((Official|Lyric|Lyrics|Audio|Video|Music|Music Video)\s*(Video|Audio|Movie|Track)?\)/gi, "")
          .replace(/\[(Official|Lyric|Lyrics|Audio|Video|Music|Music Video)\s*(Video|Audio|Movie|Track)?\]/gi, "")
          .replace(/\s*-\s*music\s*video$/i, "")
          .replace(/\s*\(music\s*video\)$/i, "")
          .trim();

        // Artist name from subtitles
        const sName = item.subtitles?.[0]?.name || "";
        let cleanArtist = sName
          .replace(/\s*-\s*Topic$/i, "")
          .replace(/\s*VEVO$/i, "")
          .trim();

        // YouTube Filter logic:
        if (service === "youtube") {
          // "When doing youtube filter out vides if you can" => Only keep if it is highly likely to be a song.
          // Exclude clearly non-music video keywords in raw title or channel name:
          const videoKeywords = [
            "unboxing", "gaming", "review", "tutorial", "episode", "talk", "reaction", "podcast", "how to", "vlog", "gameplay", 
            "news", "compilation", "trailer", "walkthrough", "fails", "funny", "livestream", "live stream", "reaction", "haul", 
            "makeup", "diy", "asmr", "funny fails", "highlights", "best moments", "review", "playthrough", "speedrun", "guide"
          ];
          
          const lowerTitle = titleRaw.toLowerCase();
          const lowerArtist = cleanArtist.toLowerCase();
          
          const hasVideoKeyword = videoKeywords.some(keyword => lowerTitle.includes(keyword) || lowerArtist.includes(keyword));
          if (hasVideoKeyword) {
            return null; // Filter out as video
          }

          // Check positive markers: YouTube channels with "Topic", "VEVO", "Records", "Label", "Music" are music.
          // Or if the title includes "Official Audio", "Lyrics", "Song" or the title has " - " indicating Artist - Song.
          const hasMusicMarker = 
            sName.toLowerCase().includes("topic") || 
            sName.toLowerCase().includes("vevo") || 
            sName.toLowerCase().includes("music") || 
            sName.toLowerCase().includes("records") || 
            sName.toLowerCase().includes("audio") || 
            lowerTitle.includes("official video") || 
            lowerTitle.includes("official audio") || 
            lowerTitle.includes("music video") || 
            lowerTitle.includes("lyrics") || 
            lowerTitle.includes("song") || 
            titleRaw.includes(" - ");
            
          if (!hasMusicMarker) {
            // If it doesn't have positive music cues, filter it out as a video
            return null;
          }
        }

        // Split format "Artist - Song" in title if artist match or missing artist
        if (cleanTitle.includes(" - ")) {
          const parts = cleanTitle.split(" - ");
          const possibleArtist = parts[0].trim();
          const possibleTrack = parts.slice(1).join(" - ").trim();
          
          if (!cleanArtist || cleanArtist.toLowerCase() === possibleArtist.toLowerCase() || cleanArtist.toLowerCase().includes("video") || cleanArtist.toLowerCase().includes("channel")) {
            cleanArtist = possibleArtist;
            cleanTitle = possibleTrack;
          }
        }

        trackName = cleanTitle;
        artistName = cleanArtist || "Unknown Artist";
        albumName = "YouTube Stream";
        ts = item.time || new Date().toISOString();
        msPlayed = 180000; // Default track duration: 3 mins
      } else {
        // 2. Map standard properties (Spotify, Apple Music, Tidal, Amazon Music, etc.)
        trackName = 
          item.master_metadata_track_name || 
          item.trackName || 
          item["Song Name"] || 
          item["Track Title"] || 
          item["Song Title"] || 
          item["Track Name"] || 
          item.track || 
          item.name || 
          item.title || 
          "";

        artistName = 
          item.master_metadata_album_artist_name || 
          item.artistName || 
          item["Artist"] || 
          item["Artist Name"] || 
          item["Album Artist"] || 
          item.artist || 
          "";

        albumName = 
          item.master_metadata_album_album_name || 
          item.albumName || 
          item["Album"] || 
          item["Album Name"] || 
          item["Album Title"] || 
          item.album || 
          "Unknown Album";

        ts = 
          item.ts || 
          item.endTime || 
          item["Play Date"] || 
          item["Date Played"] || 
          item["Activity Date Time"] || 
          item["Event End Date"] || 
          item["Event End Timestamp"] || 
          item["UTC Play Start Time"] || 
          item["Play DateTime"] || 
          item["Event Timestamp"] || 
          item.eventEndTimestamp || 
          item.timestamp || 
          item.date || 
          "";

        const rawMs = 
          item.ms_played !== undefined ? item.ms_played : (
            item.msPlayed !== undefined ? item.msPlayed : (
              item["Play Duration"] !== undefined ? item["Play Duration"] : (
                item["msPlayDuration"] !== undefined ? item["msPlayDuration"] : (
                  item["Play Duration (ms)"] !== undefined ? item["Play Duration (ms)"] : (
                    item.duration !== undefined ? item.duration : (
                      item.milliseconds !== undefined ? item.milliseconds : undefined
                    )
                  )
                )
              )
            )
          );

        if (rawMs !== undefined) {
          msPlayed = typeof rawMs === "number" ? rawMs : parseInt(rawMs, 10) || 180000;
        } else {
          msPlayed = 180000;
        }

        // Attempt to auto-categorize service based on keys or properties
        if (item.spotify_track_uri || item.master_metadata_track_name !== undefined) {
          service = "spotify";
        } else if (item["Song Name"] !== undefined || item.msPlayDuration !== undefined || item["Play Date"] !== undefined) {
          service = "apple_music";
        } else if (item["Track Title"] !== undefined || item["UTC Play Start Time"] !== undefined) {
          service = "amazon_music";
        } else if (item.track !== undefined && item.ts !== undefined) {
          service = "tidal";
        } else {
          service = "other";
        }
      }

      if (!trackName || !artistName) return null;

      return {
        master_metadata_track_name: trackName,
        trackName: trackName,
        master_metadata_album_artist_name: artistName,
        artistName: artistName,
        master_metadata_album_album_name: albumName,
        albumName: albumName,
        ms_played: msPlayed,
        msPlayed: msPlayed,
        ts: ts,
        endTime: ts,
        service: service,
        spotify_track_uri: item.spotify_track_uri || item.spotifyUri || ""
      };
    };

    try {
      const parsedRecords: any[] = [];
      let totalRead = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        const contentStr = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string || "");
          reader.onerror = (e) => reject(e);
          reader.readAsText(file);
        });

        try {
          const parsed = JSON.parse(contentStr);
          if (Array.isArray(parsed)) {
            parsedRecords.push(...parsed);
            totalRead++;
          } else if (typeof parsed === "object" && parsed !== null) {
            // Check for nested arrays (e.g. { items: [...] } or { data: [...] })
            let foundArray = false;
            for (const key of Object.keys(parsed)) {
              if (Array.isArray(parsed[key])) {
                parsedRecords.push(...parsed[key]);
                foundArray = true;
                totalRead++;
              }
            }
            // If no nested array, treat the object itself as a single record if it has track info, 
            // otherwise it might be a wrapper.
            if (!foundArray) {
              parsedRecords.push(parsed);
              totalRead++;
            }
          }
        } catch (jsonErr) {
          console.warn(`[Streaming History] Skipping non-JSON file: ${file.name}`);
        }
      }

      if (parsedRecords.length === 0) {
        throw new Error("No valid JSON arrays of streaming records found. Make sure your files are valid official backup/export files.");
      }

      const recordsToStore: any[] = [];
      parsedRecords.forEach((item: any) => {
        const standardized = standardizeRecord(item);
        if (standardized) {
          recordsToStore.push(standardized);
        }
      });

      if (recordsToStore.length === 0) {
        throw new Error("Files uploaded successfully, but no valid song streams were detected. Verify you uploaded supported music history files (Spotify, Apple Music, YouTube Music, Amazon Music, or Tidal).");
      }

      let minTime = Infinity;
      let maxTime = -Infinity;
      recordsToStore.forEach((item: any) => {
        const timeStr = item.ts || item.endTime;
        if (timeStr) {
          const ms = new Date(timeStr).getTime();
          if (!isNaN(ms)) {
            if (ms < minTime) minTime = ms;
            if (ms > maxTime) maxTime = ms;
          }
        }
      });

      const summary = {
        raw: recordsToStore,
        minDate: minTime !== Infinity ? new Date(minTime) : null,
        maxDate: maxTime !== -Infinity ? new Date(maxTime) : null,
        totalPlays: recordsToStore.length,
        loadedFilesCount: totalRead
      };

      saveStreamingDataWithQuotaGuard(summary);
    } catch (err: any) {
      console.error("[Streaming History Parser] Failure:", err);
      setStreamingParseError(err.message || "An error occurred during file parsing.");
    } finally {
      setIsParsingStreaming(false);
    }
  };

  const clearStreamingHistory = () => {
    saveStreamingDataWithQuotaGuard(null);
    setStreamingParseError(null);
    setStreamingFilesCount(0);
    setStreamingSearch("");
  };

  const loadSandboxStreamingHistory = () => {
    setIsParsingStreaming(true);
    setStreamingParseError(null);
    
    const demoPlays: any[] = [];
    const now = Date.now();
    
    const tracks = [
      { title: "Everytime We Touch", artist: "Cascada", album: "Everytime We Touch", plays: 82, duration: 196000, uri: "spotify:track:1uS900SInhOPhv99T9Krg8" },
      { title: "Evacuate the Dancefloor", artist: "Cascada", album: "Evacuate the Dancefloor", plays: 64, duration: 210000, uri: "spotify:track:039A3H8U4M2XIdYcoiIdW5" },
      { title: "Miracle", artist: "Cascada", album: "Everytime We Touch", plays: 48, duration: 218000, uri: "spotify:track:4j89RjHq8O7hB9d3c5Gsh8" },
      { title: "Bad Boy", artist: "Cascada", album: "Everytime We Touch", plays: 31, duration: 192000, uri: "spotify:track:3t0rshvO9Lq4fN2yXwGsho" },
      { title: "Because the Night", artist: "Cascada", album: "Perfect Day", plays: 27, duration: 206000, uri: "spotify:track:27zhrfGsh88Hqo49qjS8" },
      { title: "Drive to You", artist: "Jewel", album: "Goodbye Alice In Wonderland", plays: 42, duration: 254000, uri: "spotify:track:4koRUbh793Ggs0pY5VomFF" },
      { title: "Foolish Games", artist: "Jewel", album: "Pieces of You", plays: 38, duration: 339000, uri: "spotify:track:2GqoY8h9S7YqoHsh9fM" },
      { title: "You Were Meant for Me", artist: "Jewel", album: "Pieces of You", plays: 29, duration: 253000, uri: "spotify:track:4G7e8s9h8hqsh9Gho" },
      { title: "Hands", artist: "Jewel", album: "Spirit", plays: 24, duration: 234000, uri: "spotify:track:1E7e9sH8hqfh9A8" },
      { title: "Cold Heart", artist: "Elton John, Dua Lipa", album: "The Lockdown Sessions", plays: 55, duration: 202000, uri: "spotify:track:6zSp6ex6YpXtS66oZfS9" },
      { title: "As It Was", artist: "Harry Styles", album: "Harry's House", plays: 49, duration: 167000, uri: "spotify:track:4D9e8s9h8hqf2Gho" },
      { title: "Flowers", artist: "Miley Cyrus", album: "Endless Summer Vacation", plays: 36, duration: 200000, uri: "spotify:track:0yG8yH9S7hqfhG" }
    ];

    tracks.forEach(t => {
      for (let i = 0; i < t.plays; i++) {
        let playTimestamp = now;
        if (i % 5 === 0) {
          playTimestamp = now - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000);
        } else if (i % 5 === 1) {
          playTimestamp = now - Math.floor(Math.random() * 28 * 24 * 60 * 60 * 1000);
        } else if (i % 5 === 2) {
          playTimestamp = now - Math.floor(Math.random() * 170 * 24 * 60 * 60 * 1000);
        } else {
          playTimestamp = now - Math.floor((180 + Math.random() * 450) * 24 * 60 * 60 * 1000);
        }

        demoPlays.push({
          ts: new Date(playTimestamp).toISOString(),
          master_metadata_track_name: t.title,
          master_metadata_album_artist_name: t.artist,
          master_metadata_album_album_name: t.album,
          ms_played: t.duration,
          spotify_track_uri: t.uri
        });
      }
    });

    let minTime = Infinity;
    let maxTime = -Infinity;
    demoPlays.forEach((item: any) => {
      const ms = new Date(item.ts).getTime();
      if (ms < minTime) minTime = ms;
      if (ms > maxTime) maxTime = ms;
    });

    const summary = {
      raw: demoPlays,
      minDate: minTime !== Infinity ? new Date(minTime) : null,
      maxDate: maxTime !== -Infinity ? new Date(maxTime) : null,
      totalPlays: demoPlays.length,
      loadedFilesCount: 3
    };

    saveStreamingDataWithQuotaGuard(summary);
    setIsParsingStreaming(false);
  };

  // Call backend or Spotify directly to analyze Song DNA & Map coordinates
  const generateSongDNA = async (track: SpotifyTrack, sizeOverride?: number, engineOverride?: "gemini" | "spotify") => {

    setIsDNALoading(true);
    setDnaError(null);
    setSongDNA(null);
    setSelectedConstellationNode(null);
    
    // Set initially & attempt to enrich selected track cover art if it is a placeholder or has none
    setSelectedTrack(track);
    const initialImg = track.album?.images?.[0]?.url;
    const isPlaceholder = isPlaceholderImage(initialImg);
    
    if (isPlaceholder) {
      // Async enrich the selected track artwork via iTunes right away!
      const queryTerm = `${track.name} ${track.artists?.[0]?.name || ""}`.trim();
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(queryTerm)}&limit=1&media=music`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.results && data.results.length > 0) {
            const artwork = data.results[0].artworkUrl100?.replace("100x100bb", "200x200bb");
            if (artwork) {
              const enriched = {
                ...track,
                album: {
                  ...track.album,
                  images: [{ url: artwork, height: 200, width: 200 }]
                }
              };
              setSelectedTrack(enriched);
            }
          }
        })
        .catch(err => {
          console.warn("[SELECTED TRACK ARTWORK ENRICHMENT FAIL]:", err);
        });
    }

    const activeSize = sizeOverride !== undefined ? sizeOverride : constellationSize;

    try {
      // 1. Fetch similar tracks incredibly quickly from Last.fm (fetch a pool of 100 to allow robust personal streaming history filtration)
      const lastfmRes = await fetch(`/api/lastfm/similar-tracks?track=${encodeURIComponent(track.name)}&artist=${encodeURIComponent(track.artists[0]?.name || "Unknown Artist")}&limit=100`);
      let similarTracks = await lastfmRes.json();
      
      if (similarTracks) {
         similarTracks = await enrichTracksInBulk(similarTracks);
      } else {
         similarTracks = [];
      }

      const initData: SongDNA = {
        name: track.name,
        artist: track.artists[0]?.name || "Unknown Artist",
        genres: [],
        description: "Streaming AI reasoning...",
        metrics: { energy: 50, valence: 50, acousticness: 50, danceability: 50, tempo: 120, vocalPresence: 50, complexity: 50 },
        similarTracks
      };
      
      setSongDNA(initData);
      setIsDNALoading(false); // Stop loading immediately so map displays

      if (similarTracks?.length > 0) {
        setSelectedConstellationNode(similarTracks[0]);
      }

      // 2. Stream the LLM reasoning to explain "why" into the sidebar description
      const streamRes = await fetch("/api/gemini/explain-track-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           trackName: track.name,
           artistName: track.artists[0]?.name || "Unknown Artist",
           similarTracks: similarTracks.slice(0, 10).map((t: any) => `${t.title} by ${t.artist}`)
        })
      });

      if (streamRes.body) {
        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder();
        let fullDescription = "";
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const messages = chunk.split('\\n\\n');
          for (const msg of messages) {
             if (msg.startsWith('data: ')) {
               try {
                 const json = JSON.parse(msg.replace('data: ', ''));
                 if (json.text) {
                   fullDescription += json.text;
                   setSongDNA(prev => prev ? ({ ...prev, description: fullDescription }) : prev);
                 }
               } catch(e){}
             }
          }
        }
      }

    } catch (e: any) {
      console.error(e);
      setIsDNALoading(false);
      setDnaError(e.message || "An error occurred while generating DNA details.");
    }
  };

  const handleOAuthConnect = async () => {
    try {
      const response = await fetch("/api/auth/url");
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to retrieve Spotify connection URL from context server.");
      }
      const { url } = await response.json();

      // Attempt to open a popup
      const authWindow = window.open(
        url,
        "spotify_oauth_popup",
        "width=600,height=750,location=no,menubar=no,status=no,toolbar=no"
      );

      // If the browser blocks coordinate-based popups, try opening in a standard new tab
      if (!authWindow) {
        const fallbackWindow = window.open(url, "_blank");
        if (!fallbackWindow) {
          alert("Connection auth request was blocked. Please permit popups for this browser window, or open this app in a new tab using the icon at the top right of the Google AI Studio page.");
        }
      }
    } catch (error: any) {
      alert("Error establishing Spotify connection handshaking: " + error.message);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("spotify_access_token");
    localStorage.removeItem("spotify_refresh_token");
    localStorage.removeItem("spotify_expires_at");
    setAccessToken(null);
    setRefreshToken(null);
    setExpiresAt(0);
    setUserProfile(null);
    setTopTracks([]);
    setIsSandbox(true);
    setSongDNA(null);
    setSelectedTrack(null);
  };

  const handleSandboxEnter = () => {
    localStorage.removeItem("spotify_access_token");
    localStorage.removeItem("spotify_refresh_token");
    localStorage.removeItem("spotify_expires_at");
    setAccessToken(null);
    setRefreshToken(null);
    setIsSandbox(true);
    setSelectedTrack(null);
    setSongDNA(null);
  };

  // HTML5 audio playback implementation
  const toggleAudioPlaying = (url: string) => {
    if (activePreviewUrl === url) {
      if (isPlaying) {
        audioPlayerRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioPlayerRef.current?.play().catch(e => console.log("Audio playback error:", e));
        setIsPlaying(true);
      }
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setActivePreviewUrl(url);
      setIsPlaying(true);
      // Wait for React rendering of src attribute
      setTimeout(() => {
        audioPlayerRef.current?.load();
        audioPlayerRef.current?.play().catch(e => console.log("Audio play start error:", e));
      }, 50);
    }
  };

  // Trigger search item simulation for quick traversal in Sandbox mode
  const traverseToRecommendation = (node: ConnectionNode) => {
    const virtualTrack: SpotifyTrack = {
      id: node.id,
      name: node.title,
      artists: [{ id: "traverse_artist", name: node.artist }],
      album: {
        id: "recommendation_album",
        name: "Discovery Sphere",
        images: [{ url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&h=150&fit=crop", height: 150, width: 150 }],
        release_date: "Historic Discovery"
      },
      duration_ms: 180000,
      popularity: 70,
      preview_url: null,
      external_urls: { spotify: `https://open.spotify.com/search/${encodeURIComponent(`${node.title} ${node.artist}`)}` },
      uri: ""
    };
    generateSongDNA(virtualTrack);
  };


  return (
    <div className="min-h-screen bg-[#0B0B0C] text-slate-300 font-sans antialiased overflow-x-hidden selection:bg-[#10b981] selection:text-black">
      {/* Invisible HTML5 Audio back-channel */}
      {activePreviewUrl && (
        <audio 
          ref={audioPlayerRef} 
          src={activePreviewUrl} 
          onEnded={() => setIsPlaying(false)} 
          className="hidden" 
        />
      )}

      {/* Atmospheric Glowing space particles */}
      <div className="absolute top-[10%] left-[20%] w-[40vw] h-[40vh] bg-[radial-gradient(rgba(16,185,129,0.04),transparent_60%)] cosmic-glow z-0" />
      <div className="absolute bottom-[10%] right-[10%] w-[50vw] h-[50vh] bg-[radial-gradient(rgba(16,185,129,0.04),transparent_60%)] cosmic-glow z-0" />

      {/* Main Structural Layout Container */}
      <div className="relative z-10 flex flex-col min-h-screen">
        
        {/* Navigation bar */}
        <header className="border-b border-white/5 bg-[#050505]/95 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
            
            <div className="flex items-center space-x-3" id="main_logo_container">
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <Disc className="w-5 h-5 text-black animate-spin [animation-duration:8s]" />
              </div>
              <div>
                <h1 className="text-lg font-semibold font-display tracking-tight text-white flex items-center gap-1.5 leading-none">
                  BeatBrowser
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">APP</span>
                </h1>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Global Playback Constellations</p>
                  <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                  <span className="text-[9px] text-emerald-450 font-semibold tracking-wider font-mono">Gemini Musicologist Edition</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 bg-[#161618] rounded-full pl-2 pr-4 py-1.5 border border-white/5">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-500 to-emerald-400 flex items-center justify-center text-black text-[10px] font-bold overflow-hidden uppercase">
                    {userProfile?.images && userProfile.images.length > 0 ? (
                      <img src={userProfile.images[0].url} alt="Profile" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="text-left leading-tight">
                    <p className="text-xs font-medium text-white max-w-[120px] truncate">{userProfile?.display_name || "Guest Voyager"}</p>
                    <p className="text-[8px] text-emerald-400 font-mono leading-none tracking-wider uppercase">ACTIVE</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </header>

        {/* Workspace Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row gap-6 relative z-10">
          
          {/* Left Sidebar Control Dashboard (3/10 width) */}
          <section className="w-full lg:w-[32%] flex flex-col space-y-4" id="sidebar_dashboard">
            
            {/* Offline Musicology Intelligence Guide */}
            <div className="bg-[#141416] p-5 rounded-3xl border border-white/5 text-slate-300 shadow-xl text-xs relative overflow-hidden flex flex-col space-y-2">
              <div className="flex items-center space-x-2 text-emerald-400 font-semibold uppercase tracking-wider font-mono">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Offline-First Analytics Mode</span>
              </div>
              <p className="leading-relaxed text-slate-500">
                Type <strong className="text-white">ANY</strong> song or artist in the Search tab to build instant Gemini neural maps. To analyze your complete listening history, drop your official data .json exports in the <strong className="text-white">Streaming History</strong> tab!
              </p>
            </div>

            {/* Selection tab */}
            <div className="bg-[#161618] p-1 rounded-full border border-white/5 flex gap-1">
              <button
                onClick={() => setActiveTab("search")}
                className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "search"
                    ? "bg-[#2A2A2D] text-white shadow-lg shadow-black/40 font-bold"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <Search className="w-3.5 h-3.5 text-emerald-400" />
                <span>Catalog Search</span>
              </button>
              <button
                onClick={() => setActiveTab("streaming_history")}
                className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "streaming_history"
                    ? "bg-[#2A2A2D] text-white shadow-lg shadow-black/40 font-bold"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>Streaming History</span>
              </button>
            </div>

            {/* List panel */}
            <div className="bg-[#141416] rounded-3xl border border-white/5 flex flex-col flex-1 min-h-[480px] overflow-hidden shadow-2xl">
              
              {/* Header inside Panel */}
              <div className="p-4 border-b border-white/5 bg-[#050505]/40 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    {activeTab === "search" ? (
                      <>
                        <Layers className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Discover New Target</span>
                      </>
                    ) : (
                      <>
                        <Activity className="w-3.5 h-3.5 text-emerald-400 font-bold" />
                        <span>Core Streaming History</span>
                      </>
                    )}
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-mono uppercase tracking-tight">
                    {activeTab === "search"
                      ? "Search and map any track in history"
                      : "Personal Analytics from uploaded files"
                    }
                  </p>
                </div>
              </div>

              {/* Toggles if streaming history (Playcounts) */}
              {activeTab === "streaming_history" && (
                <div className="border-b border-white/5 bg-[#050505]/20 pb-3 flex flex-col space-y-2">
                  
                  {/* Time Range Selector */}
                  <div className="grid grid-cols-3 p-1 mx-3 mt-3 bg-[#050505]/60 border border-white/5 rounded-full text-[10px] font-mono leading-none font-semibold">
                    <button
                      onClick={() => setStreamingRange("last_month")}
                      className={`py-2 rounded-full text-center transition-all cursor-pointer ${
                        streamingRange === "last_month"
                          ? "bg-[#2A2A2D] text-white font-medium border border-white/5 shadow-lg shadow-black/20 font-bold"
                          : "text-slate-500 hover:text-slate-300 border border-transparent"
                      }`}
                    >
                      Last Month
                    </button>
                    <button
                      onClick={() => setStreamingRange("last_6_months")}
                      className={`py-2 rounded-full text-center transition-all cursor-pointer ${
                        streamingRange === "last_6_months"
                          ? "bg-[#2A2A2D] text-white font-medium border border-white/5 shadow-lg shadow-black/20 font-bold"
                          : "text-slate-500 hover:text-slate-300 border border-transparent"
                      }`}
                    >
                      6 Months
                    </button>
                    <button
                      onClick={() => setStreamingRange("all_time")}
                      className={`py-2 rounded-full text-center transition-all cursor-pointer ${
                        streamingRange === "all_time"
                          ? "bg-[#2A2A2D] text-white font-medium border border-white/5 shadow-lg shadow-black/20 font-bold"
                          : "text-slate-500 hover:text-slate-300 border border-transparent"
                      }`}
                    >
                      All Time
                    </button>
                  </div>

                  {streamingData && (
                    <>
                      {/* Category Selector Tabs */}
                      <div className="grid grid-cols-3 mx-3 text-center text-[9px] font-bold tracking-wider uppercase border border-white/5 rounded-full bg-black/40 overflow-hidden p-0.5">
                        <button
                          onClick={() => setStreamingCategory("tracks")}
                          className={`py-1.5 rounded-full cursor-pointer transition-all ${
                            streamingCategory === "tracks"
                              ? "bg-[#2D2D30] text-emerald-400 font-bold shadow-sm shadow-black/30"
                              : "text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          Tracks
                        </button>
                        <button
                          onClick={() => setStreamingCategory("artists")}
                          className={`py-1.5 rounded-full cursor-pointer transition-all ${
                            streamingCategory === "artists"
                              ? "bg-[#2D2D30] text-emerald-400 font-bold shadow-sm shadow-black/30"
                              : "text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          Artists
                        </button>
                        <button
                          onClick={() => setStreamingCategory("albums")}
                          className={`py-1.5 rounded-full cursor-pointer transition-all ${
                            streamingCategory === "albums"
                              ? "bg-[#2D2D30] text-emerald-400 font-bold shadow-sm shadow-black/30"
                              : "text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          Albums
                        </button>
                      </div>

                      {/* Search query box for filtering the top list */}
                      <div className="px-3">
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                            <Search className="w-3.5 h-3.5" />
                          </span>
                          <input
                            type="text"
                            placeholder={`Search top 100 ${streamingCategory}...`}
                            value={streamingSearch}
                            onChange={(e) => setStreamingSearch(e.target.value)}
                            className="w-full bg-[#050505] text-white placeholder-slate-600 pl-8 pr-4 py-1.5 rounded-full text-[10px] border border-white/5 focus:border-emerald-500 focus:outline-[#10b981]/20 focus:outline-1 transition-all font-sans font-medium"
                          />
                        </div>
                      </div>
                    </>
                  )}

                </div>
              )}

              {/* Search input field if search tab */}
              {activeTab === "search" && (
                <div className="p-3 border-b border-white/5 bg-[#050505]/20">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Type track name or artist..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#050505] text-white placeholder-slate-600 pl-9 pr-4 py-2.5 rounded-full text-xs border border-white/5 focus:border-emerald-500 focus:outline-none transition-all font-sans font-medium"
                    />
                  </div>
                </div>
              )}

              {/* Scrollable active track container */}
              <div className="flex-1 overflow-y-auto max-h-[500px]">
                
                {/* Loader during track fetching */}
                {isTracklistLoading ? (
                  <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                    <div className="w-7 h-7 rounded-full border-2 border-white/5 border-t-emerald-500 animate-spin" />
                    <p className="text-xs text-slate-500 font-mono">Formulating neural vectors...</p>
                  </div>
                ) : activeTab === "favorites" ? (
                  <div className="p-4 space-y-4">
                    {isFbLoading ? (
                      <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                        <div className="w-6 h-6 rounded-full border-2 border-white/5 border-t-amber-400 animate-spin" />
                        <p className="text-xs text-slate-500 font-mono">Decrypting Vault Vault...</p>
                      </div>
                    ) : !fbUser ? (
                      <div className="p-6 text-center space-y-4 bg-[#050505]/40 border border-white/5 rounded-2xl">
                        <div className="w-12 h-12 rounded-full bg-amber-400/5 flex items-center justify-center mx-auto border border-amber-400/10">
                          <Sparkles className="w-6 h-6 text-amber-400" />
                        </div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-white">Unlock Stored Vault</h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                          Sync your safe spaces with Google to persist your Song DNA & related artist constellations across browser sessions.
                        </p>
                        <button
                          onClick={signInWithGoogle}
                          className="w-full py-2 bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs rounded-full transition-all flex items-center justify-center space-x-2 shadow-lg cursor-pointer"
                        >
                          <User className="w-3.5 h-3.5" />
                          <span>Connect Google Vault</span>
                        </button>
                      </div>
                    ) : fbFavorites.length === 0 ? (
                      <div className="p-6 text-center space-y-3">
                        <Compass className="w-8 h-8 text-amber-400/20 mx-auto" />
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Vault is Empty</h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-sans flex flex-col gap-2">
                          <span>Build customized Song or Artist music maps.</span>
                          <span>Then, look for the "Save to Cloud" option in details to start mapping constellations!</span>
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {fbFavorites.map((fav, i) => {
                          const isActive = (fav.type === "artist" && activeMapType === "artist" && artistDNA?.name === fav.name) ||
                                           (fav.type === "song" && activeMapType === "song" && songDNA?.name === fav.name);
                          return (
                            <div
                              key={fav.favId || i}
                              onClick={() => {
                                if (fav.type === "artist") {
                                  setArtistDNA({
                                    name: fav.name,
                                    genres: ["Saved Model"],
                                    description: fav.description || "Cloud-Saved Artist Constellation Cosmos.",
                                    similarArtists: fav.nodes || []
                                  });
                                  if (fav.nodes?.length > 0) {
                                    setSelectedArtistConstellationNode(fav.nodes[0]);
                                  }
                                  setActiveMapType("artist");
                                  // Pick a dummy active track so visualization panel opens
                                  setSelectedTrack({
                                    id: "dummy",
                                    name: fav.name,
                                    artists: [{ id: "dummy", name: fav.name }],
                                    album: {
                                      id: "dummy",
                                      name: fav.name,
                                      images: fav.nodes?.[0]?.imageUrl ? [{ url: fav.nodes[0].imageUrl }] : [],
                                      release_date: ""
                                    },
                                    duration_ms: 180000,
                                    popularity: 80,
                                    preview_url: null,
                                    uri: ""
                                  });
                                } else {
                                  setSelectedTrack({
                                    id: "dummy",
                                    name: fav.name,
                                    artists: [{ id: "dummy", name: fav.artist || "" }],
                                    album: {
                                      id: "dummy",
                                      name: fav.name,
                                      images: fav.nodes?.[0]?.imageUrl ? [{ url: fav.nodes[0].imageUrl }] : [],
                                      release_date: ""
                                    },
                                    duration_ms: 180000,
                                    popularity: 80,
                                    preview_url: null,
                                    uri: ""
                                  });
                                  setSongDNA({
                                    name: fav.name,
                                    artist: fav.artist || "",
                                    genres: ["Saved Map"],
                                    description: "Cloud-Saved Celestial Constellation Map.",
                                    metrics: fav.metrics || { energy: 50, valence: 50, danceability: 50, acousticness: 50, vocalPresence: 50, complexity: 50, tempo: 120 },
                                    similarTracks: fav.nodes || []
                                  });
                                  if (fav.nodes?.length > 0) {
                                    setSelectedConstellationNode(fav.nodes[0]);
                                  }
                                  setActiveMapType("song");
                                }
                              }}
                              className={`flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-[#161618]/50 hover:bg-white/5 transition-all text-left cursor-pointer group ${
                                isActive ? "border-amber-400/35 bg-amber-400/[0.01]" : ""
                              }`}
                            >
                              <div className="flex items-center space-x-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-900 border border-white/5 flex-shrink-0 flex items-center justify-center relative">
                                  <SafeImage src={fav.nodes?.[0]?.imageUrl} alt={fav.name} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/20" />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-white truncate leading-snug flex items-center gap-1.5">
                                    {fav.name}
                                  </h4>
                                  <p className="text-[9px] text-slate-400 font-mono tracking-wide uppercase flex items-center gap-1 mt-0.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${fav.type === "artist" ? "bg-emerald-400" : "bg-purple-400"}`} />
                                    {fav.type === "artist" ? `ARTIST COSMOS` : `TRACK CONST`}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await removeMapFromFavorites(fav.name);
                                }}
                                className="p-1 px-2 border border-white/5 hover:bg-red-500/10 hover:border-red-500/20 text-slate-500 hover:text-red-400 rounded-md transition-all cursor-pointer"
                                title="Delete saved list"
                                disabled={isSavingFav}
                              >
                                {isSavingFav ? "..." : "✕"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : activeTab === "streaming_history" ? (
                  <div className="p-1 space-y-4">
                    {!streamingData ? (
                      <div className="p-4 space-y-4 font-sans text-xs">
                        {/* Drag and Drop Zone */}
                        <div 
                          className="border border-dashed border-white/10 hover:border-emerald-500/20 bg-emerald-500/[0.01]/10 rounded-2xl p-6 text-center transition-all cursor-pointer group relative flex flex-col items-center justify-center space-y-3 py-10"
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const files = e.dataTransfer.files;
                            if (files && files.length > 0) {
                              const event = { target: { files } } as any;
                              handleStreamingFiles(event);
                            }
                          }}
                        >
                          <input 
                            type="file" 
                            multiple 
                            accept=".json" 
                            id="streaming-file-input" 
                            className="hidden" 
                            onChange={handleStreamingFiles} 
                          />
                          <label htmlFor="streaming-file-input" className="absolute inset-0 cursor-pointer z-10" />
                          
                          <div className="w-12 h-12 rounded-full bg-emerald-500/5 group-hover:bg-emerald-500/10 flex items-center justify-center border border-emerald-500/10 group-hover:scale-105 transition-all">
                            <UploadCloud className="w-6 h-6 text-emerald-400" />
                          </div>
                          
                          <div>
                            <p className="text-white font-semibold text-xs text-center">Drag & drop your music history .json files</p>
                            <p className="text-[10px] text-slate-500 mt-1 font-mono text-center">Supports Spotify, Apple, YouTube, Amazon & Tidal</p>
                          </div>
                          
                          <button className="bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-1.5 rounded-full font-bold text-[10px] uppercase tracking-wider relative z-20 pointer-events-none">
                            Browse Files
                          </button>
                        </div>

                        {/* Instructions panel */}
                        <div className="bg-[#111] border border-white/5 rounded-2xl p-4 space-y-3.5 text-slate-400">
                          <div className="flex items-center space-x-2 text-emerald-400 font-mono text-[10px] font-bold uppercase tracking-wider">
                            <Info className="w-3.5 h-3.5" />
                            <span>Supported JSON Formats & Guides</span>
                          </div>
                          
                          <div className="space-y-3.5 text-[10px] leading-relaxed">
                            <div className="space-y-1">
                              <p className="text-white font-semibold flex items-center gap-1">🟢 Spotify History</p>
                              <p className="text-slate-400 pl-4">
                                Go directly to the <a href="https://www.spotify.com/account/privacy/" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline font-semibold">Spotify Privacy Settings</a>, scroll down to <span className="text-slate-200">"Request your data"</span>, and request your account data. In a few days, you'll receive a link to download a ZIP file. Extract it and upload any <code className="text-emerald-300 font-mono">StreamingHistory_music_*.json</code> or <code className="text-emerald-300 font-mono">Audio_Streaming_History_*.json</code> files.
                              </p>
                            </div>
                            
                            <div className="space-y-1 border-t border-white/5 pt-2">
                              <p className="text-white font-semibold flex items-center gap-1">🍎 Apple Music</p>
                              <p className="text-slate-400 pl-4">Upload JSON files from <code className="text-emerald-300 font-mono">Apple Media Services information</code> (e.g. Play Activity) downloaded via Apple Privacy site (<a href="https://privacy.apple.com" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">privacy.apple.com</a>).</p>
                            </div>

                            <div className="space-y-1 border-t border-white/5 pt-2">
                              <p className="text-white font-semibold flex items-center gap-1">❤️ YouTube Music & YouTube</p>
                              <p className="text-slate-400 pl-4">Export watch-history as <code className="text-emerald-300 font-mono">JSON</code> from Google Takeout (<a href="https://takeout.google.com" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">takeout.google.com</a>). Non-music videos are filtered out automatically!</p>
                            </div>

                            <div className="space-y-1 border-t border-white/5 pt-2">
                              <p className="text-white font-semibold flex items-center gap-1">🔵 Amazon Music</p>
                              <p className="text-slate-400 pl-4">
                                Request your playback history at <a href="https://www.amazon.com/gp/privacycentral/dsar/preview.html" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline font-semibold">Amazon Privacy Central</a>. Select <span className="text-slate-200 font-medium">"Amazon Music"</span> from the service dropdown and submit. Once available, download and extract the ZIP to locate your playback history JSON.
                              </p>
                            </div>

                            <div className="space-y-1 border-t border-white/5 pt-2">
                              <p className="text-white font-semibold flex items-center gap-1">🌊 Tidal History</p>
                              <p className="text-slate-400 pl-4">
                                Log into <a href="https://my.tidal.com" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline font-semibold">TIDAL Account Portal</a>, head to <span className="text-slate-200">"Privacy & Security"</span> and submit a request via <span className="text-slate-200">"Request a copy of your personal data"</span>. Upload the resulting streaming log JSON files directly.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Sandbox Demo Data Selector */}
                        <div className="bg-[#161618] border border-white/5 rounded-2xl p-4 text-center space-y-3">
                          <p className="text-[11px] text-slate-400">Want to test it out instantly? Load preconfigured musicological demo files.</p>
                          <button
                            onClick={loadSandboxStreamingHistory}
                            className="w-full bg-[#2A2A2D] hover:bg-[#323236] border border-white/5 hover:border-emerald-500/20 text-white font-mono font-medium py-2 rounded-xl text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Pre-load Sandbox Demo Data</span>
                          </button>
                        </div>

                        {isParsingStreaming && (
                          <div className="p-4 bg-emerald-500/10 border border-emerald-500/15 rounded-xl text-center flex flex-col items-center justify-center space-y-2">
                            <div className="w-5 h-5 rounded-full border-2 border-white/5 border-t-emerald-400 animate-spin" />
                            <p className="text-[10px] text-slate-300 font-mono">De-serializing JSON stream datasets...</p>
                          </div>
                        )}

                        {streamingParseError && (
                          <div className="p-3 bg-rose-500/10 border border-rose-500/15 rounded-xl text-center text-[10px] text-rose-400 font-mono">
                            Error: {streamingParseError}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-1.5 space-y-3 font-sans text-xs">
                        
                        {/* Active Loaded Summary Bar */}
                        <div className="bg-[#111] border border-white/5 rounded-2xl p-3 flex items-center justify-between">
                          <div className="space-y-0.5">
                            <p className="text-white font-bold text-[11px] flex items-center gap-1">
                              <span>{streamingData.loadedFilesCount} streaming files loaded</span>
                            </p>
                            <p className="text-[9.5px] text-slate-400 font-mono">
                              {streamingData.totalPlays.toLocaleString()} total play records analyzed
                            </p>
                            {streamingData.minDate && streamingData.maxDate && (
                              <p className="text-[9px] text-[#10b981] font-mono font-semibold">
                                Range: {new Date(streamingData.minDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })} - {new Date(streamingData.maxDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={clearStreamingHistory}
                            title="Clear stream data"
                            className="p-1.5 rounded-lg bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 text-red-400 hover:text-red-300 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Display warning or details of max timeline relative math if maxTimestamp calculation is from prior eras */}
                        {streamingData.maxDate && (new Date().getTime() - new Date(streamingData.maxDate).getTime() > 30 * 24 * 60 * 60 * 1000) && (
                          <div className="bg-[#1c1a17]/40 border border-amber-500/5 p-2 text-[9px] text-amber-500/80 rounded-xl font-sans leading-normal flex items-start gap-1.5 px-2.5">
                            <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                            <span>
                              Filters calculate times relative to latest record ({new Date(streamingData.maxDate).toLocaleDateString()}) so older archive files showcase relevant historical charts.
                            </span>
                          </div>
                        )}

                        {/* Aggregate Content Lists */}
                        <div className="space-y-1.5">
                          {displayedStreamingStats.length === 0 ? (
                            <div className="p-12 text-center text-slate-500 text-[10px] font-mono leading-relaxed">
                              No match found for "{streamingSearch}" in top 100 {streamingCategory}.
                            </div>
                          ) : (
                            displayedStreamingStats.map((item: any, idx: number) => {
                              const isTrackActive = streamingCategory === "tracks" && selectedTrack?.name?.toLowerCase() === item.name.toLowerCase() && selectedTrack?.artists?.[0]?.name?.toLowerCase() === item.artist?.toLowerCase();
                              const isArtistActive = streamingCategory === "artists" && artistDNA?.name?.toLowerCase() === item.name.toLowerCase();
                              const isActive = isTrackActive || isArtistActive;
                              
                              return (
                                <div
                                  key={item.id}
                                  onClick={() => {
                                    if (streamingCategory === "tracks") {
                                      const syntheticTrack: SpotifyTrack = {
                                        id: item.spotifyId || `virt_track_${Math.random().toString(36).substr(2, 9)}`,
                                        name: item.name,
                                        artists: [{ id: `virt_art_${Math.random().toString(36).substr(2, 9)}`, name: item.artist || "" }],
                                        album: {
                                          id: "",
                                          name: item.album || "",
                                          images: [],
                                          release_date: ""
                                        },
                                        duration_ms: item.totalMs / item.playCount,
                                        popularity: 50,
                                        preview_url: null,
                                        external_urls: { spotify: item.spotifyUri || `https://open.spotify.com/search/${encodeURIComponent(`${item.name} ${item.artist}`)}` },
                                        uri: item.spotifyUri || ""
                                      };
                                      generateSongDNA(syntheticTrack);
                                    } else if (streamingCategory === "artists") {
                                      generateArtistDNA(item.name);
                                    }
                                  }}
                                  className={`flex items-center justify-between p-2 rounded-xl border border-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-all group ${
                                    isActive ? "bg-emerald-500/5 border-emerald-500/20" : "bg-[#161616]/40"
                                  }`}
                                >
                                  
                                  {/* Rank */}
                                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                                    <span className="w-5 text-center font-mono font-bold text-slate-500 text-[10px]">
                                      {String(idx + 1).padStart(2, '0')}
                                    </span>
 
                                    {/* Item Metadata */}
                                    <div className="min-w-0">
                                      <h4 className="text-xs font-bold text-white truncate max-w-[125px] sm:max-w-[160px] leading-tight">
                                        {item.name}
                                      </h4>
                                      
                                      {/* Sub-label */}
                                      {item.artist && (
                                        <p className="text-[10px] text-slate-500 truncate max-w-[125px] sm:max-w-[160px] mt-0.5 leading-none font-sans">
                                          by {item.artist}
                                        </p>
                                      )}
                                      {streamingCategory === "tracks" && item.album && item.album !== "Unknown Album" && (
                                        <p className="text-[8.5px] text-slate-600 truncate mt-0.5 font-mono">
                                          Vol: {item.album}
                                        </p>
                                      )}
                                    </div>
                                  </div>
 
                                  {/* Counts & Stats Actions */}
                                  <div className="flex items-center space-x-1.5 flex-shrink-0">
                                    <div className="text-right font-mono pr-1">
                                      <p className="text-[10px] font-bold text-white leading-none">
                                        {item.playCount} <span className="text-[8px] text-slate-500 font-normal">plays</span>
                                      </p>
                                      <p className="text-[8.5px] text-slate-500 leading-none mt-0.5 uppercase tracking-tighter">
                                        {formatPlaytime(item.totalMs)}
                                      </p>
                                    </div>
 
                                    {/* Interaction buttons based on category */}
                                    {streamingCategory === "tracks" ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const syntheticTrack: SpotifyTrack = {
                                            id: item.spotifyId || `virt_track_${Math.random().toString(36).substr(2, 9)}`,
                                            name: item.name,
                                            artists: [{ id: `virt_art_${Math.random().toString(36).substr(2, 9)}`, name: item.artist || "" }],
                                            album: {
                                              id: "",
                                              name: item.album || "",
                                              images: [],
                                              release_date: ""
                                            },
                                            duration_ms: item.totalMs / item.playCount,
                                            popularity: 50,
                                            preview_url: null,
                                            external_urls: { spotify: item.spotifyUri || `https://open.spotify.com/search/${encodeURIComponent(`${item.name} ${item.artist}`)}` },
                                            uri: item.spotifyUri || ""
                                          };
                                          generateSongDNA(syntheticTrack);
                                        }}
                                        className={`p-1 px-1.5 rounded-lg border text-[8px] uppercase tracking-wider font-mono transition-all cursor-pointer font-bold ${
                                          isActive
                                            ? "bg-emerald-500 text-black border-transparent"
                                            : "bg-black/40 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10 hover:border-emerald-500/35"
                                        }`}
                                        title="Generate Song DNA & Overlapping Constellations"
                                      >
                                        Model
                                      </button>
                                    ) : streamingCategory === "artists" ? (
                                      <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                                        <button
                                          onClick={() => {
                                            generateArtistDNA(item.name);
                                          }}
                                          className={`p-1 px-1.5 rounded-lg border text-[8px] uppercase tracking-wider font-mono transition-all cursor-pointer font-bold ${
                                            isActive
                                              ? "bg-emerald-500 text-black border-transparent"
                                              : "bg-black/40 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10 hover:border-emerald-500/35"
                                          }`}
                                          title="Generate Artist DNA Map"
                                        >
                                          Model
                                        </button>
                                        <button
                                          onClick={() => loadDiscography(item.name)}
                                          className="p-1 px-1.5 rounded-lg bg-[#2A2A2D] text-slate-300 hover:text-emerald-400 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/20 text-[8px] uppercase tracking-wider font-mono transition-all cursor-pointer"
                                          title="Load Artist Musicological Discography Review"
                                        >
                                          Catalog
                                        </button>
                                      </div>
                                    ) : null}
 
                                  </div>
 
                                </div>
                              );
                            })
                          )}
                        </div>

                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Empty lists handling */}
                    {searchResults.length === 0 && (
                      <div className="p-8 text-center space-y-4">
                        <Music className="w-8 h-8 text-slate-600 mx-auto" />
                        <p className="text-xs text-slate-500 leading-relaxed font-sans">
                          {searchQuery.trim() 
                            ? "No matching tracks or artists found. Querying global neural base..." 
                            : "Search for any track or artist above to map details!"
                          }
                        </p>
                      </div>
                    )}

                    {/* Rendering listings */}
                    {searchResults.map((track, i) => {
                      const isSelected = selectedTrack?.id === track.id || (track.album?.name === "Artist Profile" && artistDNA?.name?.toLowerCase() === track.name?.toLowerCase());
                      const isArtist = track.album?.name === "Artist Profile" || track.uri?.includes(":artist:");
                      return (
                        <div
                          key={`${track.id}-${i}`}
                          onClick={() => {
                            if (isArtist) {
                              generateArtistDNA(track.name);
                              addToRecentSearches({ name: track.name, id: track.id, image: track.album?.images?.[0]?.url, isArtist: true });
                            } else {
                              generateSongDNA(track);
                              addToRecentSearches({ name: track.name, artist: track.artists?.[0]?.name, id: track.id, image: track.album?.images?.[0]?.url, isArtist: false });
                            }
                          }}
                          className={`flex items-center space-x-3 p-3 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-all ${
                            isSelected 
                              ? "bg-white/5 border-l-2 border-l-emerald-500" 
                              : ""
                          }`}
                        >
                          {/* Artwork */}
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0 border border-white/5">
                            <SafeImage src={track.album?.images?.[0]?.url} alt={track.name} className="w-full h-full object-cover" />
                            
                            {/* Listening play preview trigger icon */}
                            {track.preview_url && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleAudioPlaying(track.preview_url!);
                                }}
                                className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity"
                              >
                                {activePreviewUrl === track.preview_url && isPlaying ? (
                                  <Pause className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                                ) : (
                                  <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* Details Metadata */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-bold text-white truncate leading-snug">{track.name}</h4>
                              <span className={`text-[8px] font-mono uppercase px-1 py-0.2 rounded font-semibold shrink-0 ${
                                isArtist ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              }`}>
                                {isArtist ? "Artist" : "Song"}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate mt-0.5 font-sans leading-none">
                              {track.artists.map(a => a.name).join(", ")}
                            </p>
                          </div>

                          {/* Chevron right */}
                          <ChevronRight className="w-4 h-4 text-slate-600" />
                        </div>
                      );
                    })}
                  </>
                )}

              </div>

            </div>
          </section>

          {/* Right Workspace Dashboard (7/10 width) */}
          <section className="flex-1 flex flex-col space-y-6 min-w-0" id="visualization_panel">
            
            {!selectedTrack ? (
              /* State: No song selected yet, show tutorial placeholder instruction card */
              <div className="bg-[#141416] rounded-3xl border border-white/5 p-8 md:p-12 text-center shadow-2xl flex-1 flex flex-col items-center justify-center space-y-6 relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-[300px] bg-[radial-gradient(rgba(16,185,129,0.06),transparent_70%)] z-0" />
                
                <div className="relative z-10 w-20 h-20 rounded-2xl bg-[#050505] border border-white/5 flex items-center justify-center floating-card shadow-2xl">
                  <Compass className="w-9 h-9 text-emerald-400 animate-pulse" />
                </div>

                <div className="space-y-3 max-w-xl relative z-10 p-2">
                  <h2 className="text-2xl md:text-3xl font-display font-medium text-white tracking-tight">
                    Model Song DNA & Discover <span className="text-emerald-400">Related Stars</span>
                  </h2>
                  <p className="text-sm text-slate-500 leading-relaxed font-sans font-light">
                    Every song has a unique genomic code. Select any song from your top charts or perform a dynamic search to trace its composition DNA. Gemini will map coordinates of overlapping tracks inside an interactive constellation space!
                  </p>
                </div>

                <div className="relative z-10 pt-4 max-w-md w-full grid grid-cols-1 gap-3">
                  {recentSearches.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 text-slate-400 pb-1 border-b border-white/5">
                        <History className="w-3.5 h-3.5" />
                        <span className="text-xs font-mono uppercase tracking-widest">Recent Explorations</span>
                      </div>
                      {recentSearches.slice(0, 4).map((item, i) => (
                        <button
                          key={item.id + i}
                          onClick={() => {
                            if (item.isArtist) {
                              generateArtistDNA(item.name);
                            } else {
                              generateSongDNA({ id: item.id, name: item.name, artists: [{ name: item.artist || "" }], uri: "spotify:track:" + item.id } as any);
                            }
                          }}
                          className="flex w-full items-center justify-between bg-[#161618] hover:bg-[#2A2A2D] p-3 rounded-3xl border border-white/5 text-xs font-semibold text-white transition-all cursor-pointer group shadow-lg shadow-black/25 text-left"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                              <SafeImage src={item.image} alt="Cover" className="w-full h-full object-cover" />
                            </div>
                            <div className="text-left w-full overflow-hidden leading-tight">
                              <p className="font-bold truncate">{item.name}</p>
                              {item.artist && <p className="text-[10px] text-slate-500 mt-0.5 font-light truncate">{item.artist}</p>}
                            </div>
                          </div>
                          <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-mono font-semibold opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-2 transition-all">
                            <span>Analyze</span>
                            <Sparkles className="w-3 h-3" />
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      onClick={() => generateSongDNA(DEMO_SHORT_TERM_TRACKS[0])}
                      className="flex items-center justify-between bg-[#161618] hover:bg-[#2A2A2D] p-4 rounded-3xl border border-white/5 text-xs font-semibold text-white transition-all cursor-pointer group shadow-lg shadow-black/25"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-800">
                          <img src="https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=80&h=80&fit=crop" alt="Cover" className="w-full h-full object-cover" />
                        </div>
                        <div className="text-left">
                          <p className="font-bold">Try Sandbox Blueprint</p>
                          <p className="text-[10px] text-slate-500 mt-0.5 font-light">"Blinding Lights" by The Weeknd</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-mono font-semibold group-hover:translate-x-1 transition-all">
                        <span>Analyze</span>
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  )}
                </div>

              </div>
            ) : (isDNALoading || isArtistDNALoading) ? (
              /* State: Loading and analyzing song or artist DNA and building grid constellation */
              <div className="bg-[#141416] rounded-3xl border border-white/5 p-12 text-center shadow-2xl flex-1 flex flex-col items-center justify-center space-y-6 relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-[300px] bg-[radial-gradient(rgba(16,185,129,0.06),transparent_70%)] z-0" />
                
                {/* Beautiful active radar scanning visualizer element */}
                <div className="relative z-10 w-32 h-32 rounded-full border border-emerald-500/10 flex items-center justify-center">
                  <div className="absolute inset-1 rounded-full border border-dashed border-emerald-500/10 animate-[spin_10s_linear_infinite]" />
                  <div className="absolute inset-4 rounded-full border border-double border-emerald-500/25 animate-[spin_20s_linear_infinite]" />
                  <div className="absolute inset-10 bg-gradient-to-tr from-emerald-500/10 to-emerald-400/5 rounded-full animate-ping [animation-duration:2.5s]" />
                  <div className="w-14 h-14 rounded-full bg-[#050505] border border-white/5 flex items-center justify-center shadow-xl">
                    <Sparkles className="w-6 h-6 text-emerald-400 animate-pulse" />
                  </div>
                </div>

                <div className="space-y-2 relative z-10 max-w-sm">
                  <h3 className="text-xs font-mono tracking-widest text-emerald-400 uppercase font-bold">
                    {isArtistDNALoading ? "Discovering Artist Space" : "Initiating Analysis"}
                  </h3>
                  <h4 className="text-base text-white font-medium truncate font-display">
                    {isArtistDNALoading ? "Modeling Similarity Network" : `"${selectedTrack ? selectedTrack.name : "Target Song"}"`}
                  </h4>
                  <p className="text-[10px] uppercase text-slate-500 font-mono tracking-wider animate-pulse pt-2 leading-none">
                    {loaderMessage}
                  </p>
                </div>

              </div>

            ) : dnaError ? (
              /* State: Error building DNA */
              <div className="bg-[#141416] rounded-3xl border border-white/5 p-12 text-center shadow-2xl flex-1 flex flex-col items-center justify-center space-y-4">
                <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl flex items-center justify-center animate-bounce">
                  <Volume2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white font-display">DNA Modeling Failed</h3>
                  <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed mx-auto font-sans">
                    {dnaError}
                  </p>
                </div>
                <button
                  onClick={() => generateSongDNA(selectedTrack)}
                  className="text-xs text-black bg-emerald-500 hover:bg-emerald-400 font-semibold px-6 py-3 rounded-full transition-all cursor-pointer shadow-lg shadow-[#10b981]/20"
                >
                  Retry Modeling
                </button>
              </div>
            ) : (songDNA || artistDNA) ? (
              /* State: Analysis completed, render full Song DNA and Constellation dashboard */
              <div className="space-y-6 flex-1 flex flex-col" id="dna_rendering_main">
                
                {/* Part A: Main Title and DNA summary overview cell */}
                <div className="bg-[#141416] rounded-3xl border border-white/5 p-5 md:p-6 shadow-2xl flex flex-col md:flex-row gap-5 relative overflow-hidden group">
                  
                  {/* Glowing core decor */}
                  <div className="absolute top-0 right-0 w-[120px] h-[120px] bg-[radial-gradient(rgba(16,185,129,0.04),transparent_60%)] z-0" />
                  
                  {/* Close/Back Button */}
                  <button 
                    onClick={() => {
                        setSelectedTrack(null);
                        setSongDNAState(null);
                        setArtistDNAState(null);
                    }}
                    className="absolute top-4 right-4 text-slate-500 hover:text-white hover:bg-white/10 w-8 h-8 rounded-full flex items-center justify-center transition-all z-20"
                    title="Close and return to search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  
                  {/* Big Image/Art */}
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl overflow-hidden bg-slate-800 flex-shrink-0 border border-white/5 shadow-xl relative self-center md:self-start">
                    {activeMapType === "artist" ? (
                      artistDNA?.imageUrl ? (
                        <SafeImage src={artistDNA.imageUrl} alt={artistDNA.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full relative bg-cover bg-center" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=150&h=150&fit=crop')` }}>
                          <div className="absolute inset-0 bg-[#000]/40 backdrop-blur-[2px] flex items-center justify-center">
                            <User className="w-8 h-8 text-emerald-400 animate-pulse" />
                          </div>
                        </div>
                      )
                    ) : (
                      <SafeImage src={selectedTrack?.album?.images?.[0]?.url} alt={selectedTrack?.name} className="w-full h-full object-cover" />
                    )}
                    
                    {/* Floating Audio preview bubble on Artwork overlay */}
                    {activeMapType !== "artist" && selectedTrack.preview_url ? (
                      <button
                        onClick={() => toggleAudioPlaying(selectedTrack.preview_url!)}
                        className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/80 hover:bg-emerald-500 border border-white/5 hover:border-black flex items-center justify-center transition-all group"
                        title="Listen Preview Clip"
                      >
                        {activePreviewUrl === selectedTrack.preview_url && isPlaying ? (
                          <Pause className="w-4 h-4 text-emerald-400 group-hover:text-black fill-current" />
                        ) : (
                          <Play className="w-4 h-4 text-white group-hover:text-black fill-current translate-x-0.5" />
                        )}
                      </button>
                    ) : null}
                  </div>

                  {/* Core details description text */}
                  <div className="flex-1 space-y-3 relative z-10 pt-1 text-center md:text-left">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-emerald-400 font-mono tracking-widest uppercase">
                          {activeMapType === "artist" ? "ACTIVE ARTIST SPACE" : "CURRENT ACTIVE CORE"}
                        </span>
                        <h2 className="text-xl md:text-2xl font-bold font-display text-white tracking-tight leading-tight mt-0.5">
                          {activeMapType === "artist" ? artistDNA?.name : songDNA?.name}
                        </h2>
                        {activeMapType === "artist" ? (
                          <div className="flex items-center space-x-2 justify-center md:justify-start mt-0.5">
                            <p className="text-xs text-slate-400 font-medium font-sans">Aesthetic & Related Mapping</p>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <button
                              onClick={() => {
                                if (songDNA) {
                                  setActiveMapType("song");
                                }
                              }}
                              className="text-[10px] text-emerald-400 hover:text-emerald-300 hover:underline font-mono uppercase font-bold cursor-pointer"
                              title="Switch back to Song Map"
                            >
                              [Switch Back to Song Map]
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 font-medium font-sans mt-0.5">
                            By{" "}
                            {selectedTrack?.artists && selectedTrack.artists.length > 0 ? (
                              selectedTrack.artists.map((artist, idx) => (
                                <span key={artist.id || idx}>
                                  <button
                                    onClick={() => {
                                      generateArtistDNA(artist.name);
                                    }}
                                    className="text-emerald-400 hover:text-emerald-300 hover:underline font-bold transition-all inline-flex items-center space-x-1 cursor-pointer"
                                    title={`Explore ${artist.name}'s Artist Music Map`}
                                  >
                                    <span>{artist.name}</span>
                                    {idx === 0 && selectedTrack.artists.length === 1 && (
                                      <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
                                    )}
                                  </button>
                                  {idx < selectedTrack.artists.length - 1 && (
                                    <span className="text-slate-500 mx-1.5">&</span>
                                  )}
                                </span>
                              ))
                            ) : (
                              <button
                                onClick={() => {
                                  if (songDNA) {
                                    generateArtistDNA(songDNA.artist);
                                  }
                                }}
                                className="text-emerald-400 hover:text-emerald-300 hover:underline font-bold transition-all inline-flex items-center space-x-1 cursor-pointer"
                                title="Explore Artist Music Map"
                              >
                                <span>{songDNA?.artist}</span>
                                <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
                              </button>
                            )}
                          </p>
                        )}
                      </div>
                      
                      {/* Action buttons (Spotify link) */}
                      <div className="flex-shrink-0 flex flex-wrap gap-2 items-center justify-center md:justify-end">
                        {activeMapType !== "artist" && selectedTrack.external_urls?.spotify && (
                          <a
                            href={selectedTrack.external_urls.spotify}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center space-x-1.5 bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 rounded-full px-4 py-2 transition-all cursor-pointer"
                          >
                            <span>Track Link</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        
                        {activeMapType === "artist" && artistDNA && (
                          <button
                            onClick={() => loadDiscography(artistDNA.name)}
                            className="flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-bold rounded-full px-4 py-2 transition-all cursor-pointer shadow-lg shadow-[#10b981]/15"
                          >
                            <Disc className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "8s" }} />
                            <span>See Discography</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Genre badges tags */}
                    <div className="flex flex-wrap justify-center md:justify-start gap-1.5 pt-1.5">
                      {activeMapType === "artist" ? (
                        artistDNA?.genres.map((g, i) => (
                          <span
                            key={`${g}-${i}`}
                            className="text-[10px] bg-[#050505] text-emerald-400 border border-white/5 font-mono px-2 py-0.5 rounded-md uppercase"
                          >
                            {g}
                          </span>
                        ))
                      ) : (
                        songDNA?.genres.map((g, i) => (
                          <span
                            key={`${g}-${i}`}
                            className="text-[10px] bg-[#050505] text-emerald-400 border border-white/5 font-mono px-2 py-0.5 rounded-md uppercase"
                          >
                            {g}
                          </span>
                        ))
                      )}
                    </div>

                    {/* Written scientific evaluation review from Gemini */}
                    <div className="bg-[#050505]/40 rounded-xl p-4 border border-white/5">
                      <p className="text-xs text-slate-300 leading-relaxed font-sans font-light">
                        {activeMapType === "artist" ? artistDNA?.description : songDNA?.description}
                      </p>
                    </div>

                  </div>

                </div>


                {/* Part B: Split metrics vs map */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                  
                  {/* Left Column Metric Sliders widget */}
                  <div className={`col-span-12 ${isMapExpanded ? "md:col-span-12 order-2" : "md:col-span-5 order-1"} bg-[#141416] rounded-3xl border border-white/5 p-5 md:p-6 shadow-2xl flex flex-col justify-between transition-all duration-300`}>
                    {activeMapType === "artist" && artistDNA ? (
                      <div>
                        <div className="flex items-center space-x-2 border-b border-white/5 pb-3 mb-4">
                          <Activity className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-bold uppercase tracking-wider text-white">Artist Aesthetic Spectrum</span>
                        </div>

                        <div className="space-y-4">
                          {/* Intensity slider */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[11px] font-sans">
                              <span className="text-slate-500 font-medium">Production Energy / Intensity</span>
                              <span className="text-emerald-400 font-bold font-mono">{getArtistStyleMetrics(artistDNA.name).intensity}%</span>
                            </div>
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                                style={{ width: `${getArtistStyleMetrics(artistDNA.name).intensity}%` }}
                              />
                            </div>
                          </div>

                          {/* Experimentalism slider */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[11px] font-sans">
                              <span className="text-slate-500 font-medium">Artistic Experimentalism</span>
                              <span className="text-emerald-400 font-bold font-mono">{getArtistStyleMetrics(artistDNA.name).experimentalism}%</span>
                            </div>
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                                style={{ width: `${getArtistStyleMetrics(artistDNA.name).experimentalism}%` }}
                              />
                            </div>
                          </div>

                          {/* Melodic Brightness slider */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[11px] font-sans">
                              <span className="text-slate-500 font-medium">Melodic Brightness</span>
                              <span className="text-emerald-400 font-bold font-mono">{getArtistStyleMetrics(artistDNA.name).brightness}%</span>
                            </div>
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                                style={{ width: `${getArtistStyleMetrics(artistDNA.name).brightness}%` }}
                              />
                            </div>
                          </div>

                          {/* Rhythm presence slider */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[11px] font-sans">
                              <span className="text-slate-500 font-medium">Rhythmic Presence / Dance</span>
                              <span className="text-emerald-400 font-bold font-mono">{getArtistStyleMetrics(artistDNA.name).rhythm}%</span>
                            </div>
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-[#10b981] rounded-full transition-all duration-1000"
                                style={{ width: `${getArtistStyleMetrics(artistDNA.name).rhythm}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Node List Index Directory */}
                        <div className="mt-6 pt-4 border-t border-white/5">
                          <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block mb-2">Constellation Directories</span>
                          <div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                            {filteredSimilarArtists.slice(0, 10).map((art, idx) => (
                              <button
                                key={`${art.id}-${idx}`}
                                onClick={() => {
                                  setSelectedArtistConstellationNode(art);
                                }}
                                className={`text-[10px] p-2 text-left rounded-lg bg-emerald-500/5 hover:bg-emerald-500/15 border text-slate-300 font-sans tracking-wide truncate transition-all cursor-pointer ${
                                  selectedArtistConstellationNode?.id === art.id ? 'border-emerald-500 text-emerald-400 font-semibold' : 'border-white/5'
                                }`}
                              >
                                {art.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : songDNA ? (
                      <div>
                        <div className="flex items-center space-x-2 border-b border-white/5 pb-3 mb-4">
                          <Activity className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-bold uppercase tracking-wider text-white">DNA Metric Profiler</span>
                        </div>

                        <div className="space-y-4">
                          {/* Energy bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[11px] font-sans">
                              <span className="text-slate-500 font-medium">Energy / Drive</span>
                              <span className="text-emerald-400 font-bold font-mono">{songDNA.metrics.energy}%</span>
                            </div>
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                                style={{ width: `${songDNA.metrics.energy}%` }}
                              />
                            </div>
                          </div>

                          {/* Valence / Happiness bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[11px] font-sans">
                              <span className="text-slate-500 font-medium">Happiness / Brightness</span>
                              <span className="text-emerald-400 font-bold font-mono">{songDNA.metrics.valence}%</span>
                            </div>
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                                style={{ width: `${songDNA.metrics.valence}%` }}
                              />
                            </div>
                          </div>

                          {/* Danceability bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[11px] font-sans">
                              <span className="text-slate-500 font-medium">Dance Groove / Beat</span>
                              <span className="text-emerald-400 font-bold font-mono">{songDNA.metrics.danceability}%</span>
                            </div>
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                                style={{ width: `${songDNA.metrics.danceability}%` }}
                              />
                            </div>
                          </div>

                          {/* Acousticness bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[11px] font-sans">
                              <span className="text-slate-500 font-medium">Organic / Acoustic</span>
                              <span className="text-emerald-400 font-bold font-mono">{songDNA.metrics.acousticness}%</span>
                            </div>
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                                style={{ width: `${songDNA.metrics.acousticness}%` }}
                              />
                            </div>
                          </div>

                          {/* Vocal presence bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[11px] font-sans">
                              <span className="text-slate-500 font-medium">Vocal Forwardness</span>
                              <span className="text-emerald-400 font-bold font-mono">{songDNA.metrics.vocalPresence}%</span>
                            </div>
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                                style={{ width: `${songDNA.metrics.vocalPresence}%` }}
                              />
                            </div>
                          </div>

                          {/* Structural complexity bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[11px] font-sans">
                              <span className="text-slate-500 font-medium">Structural Complexity</span>
                              <span className="text-emerald-400 font-bold font-mono">{songDNA.metrics.complexity}%</span>
                            </div>
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                                style={{ width: `${songDNA.metrics.complexity}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {activeMapType === "artist" && artistDNA ? (
                      <div className="mt-6 border-t border-white/5 pt-4 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-mono uppercase">COSMIC NETWORK VALUE</span>
                        <span className="text-lg font-bold text-white font-mono">100% <span className="text-xs text-slate-500 font-light font-sans">ALIGNMENT</span></span>
                      </div>
                    ) : songDNA ? (
                      <div className="mt-6 border-t border-white/5 pt-4 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-mono uppercase">ESTIMATED TEMPO SPEED</span>
                        <span className="text-lg font-bold text-white font-mono">{songDNA.metrics.tempo} <span className="text-xs text-slate-400 font-light font-sans">BPM</span></span>
                      </div>
                    ) : null}

                  </div>


                  {/* Right Column 2D Coordinate Discovery Star-map */}
                  {!isFullscreenMap && (
                    <div className={`col-span-12 ${isMapExpanded ? "md:col-span-12 order-1" : "md:col-span-7 order-2"}`}>
                      <ConstellationMap
                        activeMapType={activeMapType}
                        coreName={activeMapType === 'artist' ? (artistDNA?.name || '') : (songDNA?.name || '')}
                        filteredSimilarArtists={filteredSimilarArtists}
                        filteredSimilarTracks={filteredSimilarTracks}
                        selectedArtistConstellationNode={selectedArtistConstellationNode}
                        setSelectedArtistConstellationNode={setSelectedArtistConstellationNode}
                        selectedConstellationNode={selectedConstellationNode}
                        setSelectedConstellationNode={setSelectedConstellationNode}
                        constellationSize={constellationSize}
                        setConstellationSize={setConstellationSize}
                        familiarityLevel={familiarityLevel}
                        setFamiliarityLevel={setFamiliarityLevel}
                        discoveryMode={discoveryMode}
                        setDiscoveryMode={setDiscoveryMode}
                        hasStreamingHistory={!!streamingData}
                        isDNALoading={isDNALoading}
                        isArtistDNALoading={isArtistDNALoading}
                        isFullscreenMap={isFullscreenMap}
                        setIsFullscreenMap={setIsFullscreenMap}
                        isMapExpanded={isMapExpanded}
                        setIsMapExpanded={setIsMapExpanded}
                        traverseToRecommendation={traverseToRecommendation}
                        generateArtistDNA={generateArtistDNA}
                        generateSongDNA={generateSongDNA}
                        selectedTrack={selectedTrack}
                        artistDNA={artistDNA}
                        songDNA={songDNA}
                        activePreviewUrl={activePreviewUrl}
                        isPlaying={isPlaying}
                        toggleAudioPlaying={toggleAudioPlaying}
                        mapEngine={mapEngine}
                        setSelectedTrack={setSelectedTrack}
                        loadDiscography={loadDiscography}
                      />
                    </div>
                  )}


                </div>

              </div>
            ) : null}

          </section>

        </main>

        {isFullscreenMap && (
<ConstellationMap
  activeMapType={activeMapType}
  coreName={activeMapType === 'artist' ? (artistDNA?.name || '') : (songDNA?.name || '')}
  filteredSimilarArtists={filteredSimilarArtists}
  filteredSimilarTracks={filteredSimilarTracks}
  selectedArtistConstellationNode={selectedArtistConstellationNode}
  setSelectedArtistConstellationNode={setSelectedArtistConstellationNode}
  selectedConstellationNode={selectedConstellationNode}
  setSelectedConstellationNode={setSelectedConstellationNode}
  constellationSize={constellationSize}
  setConstellationSize={setConstellationSize}
  familiarityLevel={familiarityLevel}
  setFamiliarityLevel={setFamiliarityLevel}
  discoveryMode={discoveryMode}
  setDiscoveryMode={setDiscoveryMode}
  hasStreamingHistory={!!streamingData}
  isDNALoading={isDNALoading}
  isArtistDNALoading={isArtistDNALoading}
  isFullscreenMap={isFullscreenMap}
  setIsFullscreenMap={setIsFullscreenMap}
  isMapExpanded={isMapExpanded}
  setIsMapExpanded={setIsMapExpanded}
  traverseToRecommendation={traverseToRecommendation}
  generateArtistDNA={generateArtistDNA}
  generateSongDNA={generateSongDNA}
  selectedTrack={selectedTrack}
  artistDNA={artistDNA}
  songDNA={songDNA}
  activePreviewUrl={activePreviewUrl}
  isPlaying={isPlaying}
  toggleAudioPlaying={toggleAudioPlaying}
  mapEngine={mapEngine}
  setSelectedTrack={setSelectedTrack}
  loadDiscography={loadDiscography}
/>
)}

        {/* Footer Area */}
        <footer className="border-t border-white/5 py-6 bg-[#050505]/95">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
            <p className="flex items-center flex-wrap gap-x-2 gap-y-1">
              <span>© 2026 BeatBrowser console. Model predictions powered server-side by Gemini.</span>
            </p>
          </div>
        </footer>

        {/* Dynamic sliding discography drawer overlay */}
        {isDiscographyOpen && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex justify-end transition-all duration-300">
            {/* Click backdrop to close */}
            <div 
              className="absolute inset-0 cursor-pointer" 
              onClick={() => setIsDiscographyOpen(false)}
            />
            
            {/* Drawer body card container */}
            <div className="w-full max-w-xl bg-[#0d0d0f] border-l border-white/10 h-full shadow-2xl relative flex flex-col z-50 animate-in slide-in-from-right duration-350">
              
              {/* Drawer Header details */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#111113]/95 sticky top-0 z-20 backdrop-blur-md">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <Disc className="w-5 h-5 text-emerald-400 animate-spin" style={{ animationDuration: "12s" }} />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-emerald-400 font-mono tracking-widest uppercase block">
                      Artist Discography Blueprint
                    </span>
                    <h3 className="text-lg font-bold text-white font-display uppercase tracking-tight mt-0.5">
                      {activeDiscography?.artist || "Loading Discography..."}
                    </h3>
                  </div>
                </div>

                <button
                  onClick={() => setIsDiscographyOpen(false)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
                  title="Close Discography Drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer scroll content body */}
              <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5 bg-[#0a0a0c]/80">
                {isDiscographyLoading ? (
                  <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border-2 border-emerald-500/10 border-t-emerald-500 animate-spin" />
                      <Disc className="w-8 h-8 text-emerald-400 absolute inset-0 m-auto animate-pulse" />
                    </div>
                    <div className="space-y-1.5 max-w-xs">
                      <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest animate-pulse">
                        Unraveling official catalogue...
                      </p>
                      <p className="text-[11px] text-slate-500 font-sans font-light">
                        Gemini is modeling historic record structures while parsing music catalog collections in parallel.
                      </p>
                    </div>
                  </div>
                ) : discographyError ? (
                  <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-4">
                    <div className="p-3 bg-red-500/10 rounded-full border border-red-500/20 text-red-400">
                      <Info className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-white">Catalog Retrieval Error</h4>
                      <p className="text-xs text-slate-400 max-w-xs leading-normal">
                        {discographyError}
                      </p>
                    </div>
                    <button
                      onClick={() => activeDiscography && loadDiscography(activeDiscography.artist)}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-[10px] uppercase font-mono tracking-wider rounded-lg transition-all cursor-pointer"
                    >
                      Retry Connection
                    </button>
                  </div>
                ) : activeDiscography ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 px-1">
                      <span>CHRONOLOGICAL ORDER</span>
                      <span>{activeDiscography.albums.length} RELEASES RECORDED</span>
                    </div>

                    <div className="space-y-4">
                      {activeDiscography.albums.length === 0 ? (
                        <div className="text-center p-12 border border-white/5 rounded-2xl border-dashed">
                          <p className="text-xs text-slate-500 font-mono uppercase tracking-tight">No releases found for this artist in our catalog.</p>
                        </div>
                      ) : (
                        activeDiscography.albums.map((album, idx) => (
                          <div 
                            key={idx}
                            className="bg-[#141416]/95 border border-white/5 rounded-2xl p-4 md:p-5 hover:border-emerald-500/20 hover:bg-[#16161a] hover:shadow-[0_4px_30px_rgba(16,185,129,0.02)] transition-all duration-300 flex flex-col sm:flex-row gap-4 relative overflow-hidden group"
                          >
                            {/* Accent glow on hover */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(rgba(16,185,129,0.015),transparent_60%)] pointer-events-none" />

                          {/* Album Art container */}
                          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-[#18181b] border border-white/10 flex-shrink-0 relative group-hover:border-emerald-500/30 transition-all shadow-md self-start">
                            {album.imageUrl ? (
                              <img 
                                src={album.imageUrl} 
                                alt={album.title} 
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-emerald-500/10 via-[#0a0a0c] to-teal-500/5 flex items-center justify-center">
                                <Disc className="w-8 h-8 text-emerald-500/30 animate-spin" style={{ animationDuration: "10s" }} />
                              </div>
                            )}

                            {/* Release format format overlay badge */}
                            <span className="absolute bottom-1 right-1 text-[8px] font-extrabold font-mono tracking-wider bg-black/80 text-emerald-400 px-1.5 py-0.5 rounded uppercase border border-white/5">
                              {album.type}
                            </span>
                          </div>

                          {/* Album Details text */}
                          <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <h4 className="text-sm font-bold text-white tracking-tight leading-tight group-hover:text-emerald-400 transition-colors">
                                {album.title}
                              </h4>
                              <span className="text-xs text-slate-500 font-mono font-semibold">
                                ({album.year})
                              </span>
                            </div>

                            {/* Synopsis review block */}
                            <p className="text-xs text-slate-400 font-sans leading-relaxed font-light mt-1">
                              {album.synopsis}
                            </p>

                            {/* Breakout Key Tracks list */}
                            {album.keyTracks && album.keyTracks.length > 0 && album.keyTracks.every(t => !t.toLowerCase().includes("apple music")) && (
                              <div className="pt-2">
                                <span className="text-[8px] font-mono font-bold text-emerald-400/80 uppercase tracking-widest block mb-1">
                                  Carrier Highlights
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {album.keyTracks.map((trackName, tIdx) => (
                                    <span 
                                      key={tIdx}
                                      className="text-[9px] font-mono bg-[#050505]/80 text-[#94a3b8] px-2 py-0.5 rounded border border-white/5 flex items-center space-x-1"
                                    >
                                      <span className="text-[7.5px] text-emerald-400 font-extrabold">★</span>
                                      <span className="font-semibold">{trackName}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )))}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-12 text-center font-mono text-xs text-slate-500 uppercase tracking-tight">
                    Select an artist to model their master catalogue map.
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
