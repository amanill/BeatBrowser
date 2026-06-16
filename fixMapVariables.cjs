const fs = require('fs');
let c = fs.readFileSync('src/components/ConstellationMap.tsx', 'utf8');

c = c.replace(/handleCanvasMouseDown/g, 'handleMapMouseDown');
c = c.replace(/handleCanvasMouseMove/g, 'handleMapMouseMove');
c = c.replace(/handleCanvasMouseUp/g, 'handleMapMouseUpOrLeave');
c = c.replace(/handleCanvasTouchStart/g, 'handleMapTouchStart');
c = c.replace(/handleCanvasTouchMove/g, 'handleMapTouchMove');
c = c.replace(/handleCanvasTouchEnd/g, 'handleMapTouchEnd');

c = c.replace(
  "import { Compass,",
  "import { Compass, User, Disc,"
);
c = c.replace(
  "export interface ConstellationMapProps {",
  "import { SafeImage } from './SafeImage';\nexport interface ConstellationMapProps {"
);

c = c.replace(
  "mapEngine: \"gemini\" | \"spotify\";",
  "mapEngine: \"gemini\" | \"spotify\";\n  setSelectedTrack: (t: any) => void;\n  loadDiscography: (artist: string) => void;"
);

c = c.replace(
  "mapEngine\n}) => {",
  "mapEngine,\n  setSelectedTrack,\n  loadDiscography\n}) => {"
);

fs.writeFileSync('src/components/ConstellationMap.tsx', c);
console.log('Fixed ConstellationMap.tsx');
