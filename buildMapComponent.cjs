const fs = require('fs');

let content = fs.readFileSync('extracted.txt', 'utf-8');

// The exported function will be:
const finalComponent = `import React, { useState, useRef } from 'react';
import { Compass, RotateCcw, Maximize2, Minimize2, Layers, Check, Play, Square, ChevronRight } from 'lucide-react';
import { ConnectionNode, ArtistConnectionNode } from '../types';

export interface ConstellationMapProps {
  activeMapType: "song" | "artist";
  coreName: string;
  filteredSimilarArtists: ArtistConnectionNode[];
  filteredSimilarTracks: ConnectionNode[];
  selectedArtistConstellationNode: ArtistConnectionNode | null;
  setSelectedArtistConstellationNode: (node: ArtistConnectionNode | null) => void;
  selectedConstellationNode: ConnectionNode | null;
  setSelectedConstellationNode: (node: ConnectionNode | null) => void;
  constellationSize: number;
  setConstellationSize: (size: number) => void;
  familiarityLevel: "all" | "familiar" | "mainstream";
  setFamiliarityLevel: (level: "all" | "familiar" | "mainstream") => void;
  isDNALoading: boolean;
  isArtistDNALoading: boolean;
  isFullscreenMap: boolean;
  setIsFullscreenMap: React.Dispatch<React.SetStateAction<boolean>>;
  isMapExpanded: boolean;
  setIsMapExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  traverseToRecommendation: (node: any) => void;
  generateArtistDNA: (artist: string, size?: number) => void;
  generateSongDNA: (track: any, size?: number) => void;
  selectedTrack: any;
  artistDNA: any;
  songDNA: any;
  activePreviewUrl: string | null;
  isPlaying: boolean;
  toggleAudioPlaying: (url: string) => void;
  mapEngine: "gemini" | "spotify";
}

export const ConstellationMap: React.FC<ConstellationMapProps> = ({
  activeMapType,
  coreName,
  filteredSimilarArtists,
  filteredSimilarTracks,
  selectedArtistConstellationNode,
  setSelectedArtistConstellationNode,
  selectedConstellationNode,
  setSelectedConstellationNode,
  constellationSize,
  setConstellationSize,
  familiarityLevel,
  setFamiliarityLevel,
  isDNALoading,
  isArtistDNALoading,
  isFullscreenMap,
  setIsFullscreenMap,
  isMapExpanded,
  setIsMapExpanded,
  traverseToRecommendation,
  generateArtistDNA,
  generateSongDNA,
  selectedTrack,
  artistDNA,
  songDNA,
  activePreviewUrl,
  isPlaying,
  toggleAudioPlaying,
  mapEngine
}) => {
  const [mapZoom, setMapZoom] = useState(1.1);
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const mapDragStart = useRef({ x: 0, y: 0 });
  const mapOffsetStart = useRef({ x: 0, y: 0 });
  const constellationCanvasRef = useRef<HTMLDivElement | null>(null);

  const setCanvasRef = (el: HTMLDivElement | null) => {
    constellationCanvasRef.current = el;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    setIsDraggingMap(true);
    mapDragStart.current = { x: e.clientX, y: e.clientY };
    mapOffsetStart.current = { ...mapOffset };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingMap) return;
    const dx = e.clientX - mapDragStart.current.x;
    const dy = e.clientY - mapDragStart.current.y;
    setMapOffset({
      x: mapOffsetStart.current.x + dx,
      y: mapOffsetStart.current.y + dy
    });
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingMap(false);
  };

  const handleCanvasTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      setIsDraggingMap(true);
      mapDragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      mapOffsetStart.current = { ...mapOffset };
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingMap || e.touches.length === 0) return;
    const dx = e.touches[0].clientX - mapDragStart.current.x;
    const dy = e.touches[0].clientY - mapDragStart.current.y;
    setMapOffset({
      x: mapOffsetStart.current.x + dx,
      y: mapOffsetStart.current.y + dy
    });
  };

  const handleCanvasTouchEnd = () => {
    setIsDraggingMap(false);
  };

  const isFullscreen = isFullscreenMap;

  // Returning the extracted div content directly:
${content.replace(/const renderConstellationMap = \(isFullscreen: boolean\) => \{/, '').replace(/\s*return \(\s*/, '  return (\n').replace(/;\s*\}\s*$/, ';')}
};
`;

fs.writeFileSync('src/components/ConstellationMap.tsx', finalComponent);
