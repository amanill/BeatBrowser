const fs = require('fs');

const appPath = 'src/App.tsx';
let appContent = fs.readFileSync(appPath, 'utf8');

// 1. Add the import
const importStatement = "import { ConstellationMap } from './components/ConstellationMap';\n";
appContent = appContent.replace(
  'import { DEMO_SHORT_TERM_TRACKS',
  importStatement + 'import { DEMO_SHORT_TERM_TRACKS'
);

// 2. Remove renderConstellationMap definition
const lines = appContent.split('\n');
const startIdx = lines.findIndex(line => line.includes('const renderConstellationMap = (isFullscreen: boolean) => {'));
let endIdx = startIdx;
let bracketCount = 0;
let foundStart = false;

for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('{')) {
        foundStart = true;
        bracketCount += (line.match(/\{/g) || []).length;
    }
    if (line.includes('}')) {
        bracketCount -= (line.match(/\}/g) || []).length;
    }
    
    if (foundStart && bracketCount === 0) {
        endIdx = i;
        break;
    }
}

// Remove the lines from startIdx to endIdx
lines.splice(startIdx, endIdx - startIdx + 1);

appContent = lines.join('\n');

// 3. Replace calls to renderConstellationMap
// Find and replace {!isFullscreenMap && renderConstellationMap(false)}
const constellationProps = `<ConstellationMap
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
/>`;

appContent = appContent.replace('{!isFullscreenMap && renderConstellationMap(false)}', `{!isFullscreenMap && (\n${constellationProps}\n)}`);
appContent = appContent.replace('{isFullscreenMap && renderConstellationMap(true)}', `{isFullscreenMap && (\n${constellationProps}\n)}`);

fs.writeFileSync(appPath, appContent);
console.log('App.tsx updated');
