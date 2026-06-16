const fs = require('fs');

const appPath = 'src/App.tsx';
let appContent = fs.readFileSync(appPath, 'utf8');

appContent = appContent.replace(
  /mapEngine={mapEngine}/g,
  "mapEngine={mapEngine}\n  setSelectedTrack={setSelectedTrack}\n  loadDiscography={loadDiscography}"
);

fs.writeFileSync(appPath, appContent);
console.log('App.tsx missing props fixed');
