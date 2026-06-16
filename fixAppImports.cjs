const fs = require('fs');

const appPath = 'src/App.tsx';
let appContent = fs.readFileSync(appPath, 'utf8');

// I also need to replace the local definition of isPlaceholderImage if it's there
appContent = appContent.replace(
  /const isPlaceholderImage = \(\w+\?: string\): boolean => \{[\s\S]*?^};\n/m, 
  ""
);

// Remove the local definition of SafeImage
appContent = appContent.replace(
  /interface SafeImageProps \{[\s\S]*?^};/m, 
  ""
);
appContent = appContent.replace(
  /const SafeImage: React.FC<SafeImageProps> = \(\{[\s\S]*?^};/m, 
  ""
);

// Add the import
const importStatement = "import { isPlaceholderImage } from './utils';\nimport { SafeImage } from './components/SafeImage';\n";
appContent = appContent.replace(
  'import { DEMO_SHORT_TERM_TRACKS',
  importStatement + 'import { DEMO_SHORT_TERM_TRACKS'
);

fs.writeFileSync(appPath, appContent);
console.log('App.tsx imports fixed');
