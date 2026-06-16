import fs from 'fs';

async function main() {
  const html = fs.readFileSync('/shared.html', 'utf8');
  console.log('Searching for occurrences of spotify, listen, image, gone, 410...');
  
  const keywords = ['spotify', 'listen', 'image', 'gone', '410', 'urls2', 'msid', 'mbid', 'lookup'];
  for (const kw of keywords) {
    let count = 0;
    let idx = html.toLowerCase().indexOf(kw);
    while (idx !== -1) {
      count++;
      idx = html.toLowerCase().indexOf(kw, idx + kw.length);
    }
    console.log(`Keyword '${kw}': count = ${count}`);
  }
}

main();
