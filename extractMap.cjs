const fs = require('fs');

const appContent = fs.readFileSync('src/App.tsx', 'utf-8');
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

const functionContent = lines.slice(startIdx, endIdx + 1).join('\n');
fs.writeFileSync('extracted.txt', functionContent);
console.log('Extracted lines:', startIdx, 'to', endIdx);
