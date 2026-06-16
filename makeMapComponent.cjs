const fs = require('fs');

const componentContent = `
import React, { useState, useRef } from 'react';
import { Compass, RotateCcw, Maximize2, Minimize2, Layers, Check, Play, Square, ChevronRight } from 'lucide-react';
import { ConnectionNode, ArtistConnectionNode } from '../types';

interface ConstellationMapProps {
  type: "song" | "artist";
  coreName: string;
  nodes: (ConnectionNode | ArtistConnectionNode)[];
  selectedNode: ConnectionNode | ArtistConnectionNode | null;
  onSelectNode: (node: any) => void;
  constellationSize: number;
  onSizeChange: (size: number) => void;
  familiarityLevel: "all" | "familiar" | "mainstream";
  onFamiliarityChange: (level: "all" | "familiar" | "mainstream") => void;
  isLoading: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onTraverse: (node: any) => void;
  activePreviewUrl?: string | null;
  isPlaying?: boolean;
  onTogglePlay?: (url: string) => void;
  onArtistClick?: (artistName: string) => void;
}

export const ConstellationMap: React.FC<ConstellationMapProps> = ({
  type,
  coreName,
  nodes,
  selectedNode,
  onSelectNode,
  constellationSize,
  onSizeChange,
  familiarityLevel,
  onFamiliarityChange,
  isLoading,
  isFullscreen,
  onToggleFullscreen,
  isExpanded,
  onToggleExpanded,
  onTraverse,
  activePreviewUrl,
  isPlaying,
  onTogglePlay,
  onArtistClick
}) => {
  const [mapZoom, setMapZoom] = useState(1.1);
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 });
  const [isDraggingMap, setIsDraggingMap] = useState(false);
  const mapDragStart = useRef({ x: 0, y: 0 });
  const mapOffsetStart = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement | null>(null);

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

  return (
    // ... we will put the extracted map here, modified to use the props ...
    <div className="constellation-map-placeholder"></div>
  );
};
`;

fs.writeFileSync('src/components/ConstellationMap.tsx', componentContent);
