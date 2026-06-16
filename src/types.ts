export interface SpotifyProfile {
  id: string;
  display_name: string;
  email?: string;
  images?: { url: string; height?: number; width?: number }[];
  external_urls?: { spotify: string };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: {
    id: string;
    name: string;
    images: { url: string; height?: number; width?: number }[];
    release_date: string;
  };
  duration_ms: number;
  popularity?: number;
  preview_url?: string | null;
  external_urls?: { spotify: string };
  uri?: string;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  images?: { url: string; height: number; width: number }[];
  genres?: string[];
  popularity?: number;
  external_urls?: { spotify: string };
}

export interface SongDNAMetrics {
  energy: number; // 0 to 100
  valence: number; // 0 to 100
  acousticness: number; // 0 to 100
  danceability: number; // 0 to 100
  tempo: number; // BPM
  vocalPresence: number; // 0 to 100
  complexity: number; // 0 to 100
}

export interface ConnectionNode {
  id: string;
  title: string;
  artist: string;
  similarityScore: number; // 0 to 100
  explanation: string;
  x: number; // -100 to 100
  y: number; // -100 to 100
  category: string; // e.g. "Rhythmic Brother", "Harmonic Cousin", "Vibe Match", "Genre Next-Door"
  imageUrl?: string;
  musicBrainzReleaseId?: string;
  popularity?: number; // 0 to 100 general mainstream familiarity
}

export interface SongDNA {
  name: string;
  artist: string;
  genres: string[];
  description: string;
  metrics: SongDNAMetrics;
  similarTracks: ConnectionNode[];
}

export interface ArtistConnectionNode {
  id: string;
  name: string;
  similarityScore: number; // 0 to 100
  explanation: string;
  x: number; // -100 to 100
  y: number; // -100 to 100
  category: string; // e.g., "French Touch Disciple", "Electro-House Peer", "Genre Cousin"
  imageUrl?: string;
  musicBrainzId?: string;
  popularity?: number; // 0 to 100 general mainstream familiarity
}

export interface ArtistDNA {
  name: string;
  genres: string[];
  description: string;
  similarArtists: ArtistConnectionNode[];
}

export interface AlbumDiscographyItem {
  title: string;
  year: string;
  type: string;
  keyTracks: string[];
  synopsis: string;
  imageUrl?: string;
  spotifyUrl?: string;
  spotifyId?: string;
}

export interface ArtistDiscography {
  artist: string;
  albums: AlbumDiscographyItem[];
}
