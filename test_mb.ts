import fetch from 'node-fetch';

async function testMusicBrainzUrl(resource: string) {
  try {
    const url = `https://musicbrainz.org/ws/2/url?resource=${encodeURIComponent(resource)}&fmt=json`;
    console.log(`Querying MusicBrainz URL database for: ${resource}...`);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'MusicMapAgent/1.0.0 (skiskiacm@gmail.com)'
      }
    });
    console.log(`Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log('Successfully retrieved mapping data! Details:');
      console.log(JSON.stringify(data, null, 2).substring(0, 1000));
    } else {
      console.log('Error text:', await res.text());
    }
  } catch (err: any) {
    console.log('Error fetching from MusicBrainz:', err.message);
  }
}

async function main() {
  // Test a Spotify Artist URL
  await testMusicBrainzUrl('https://open.spotify.com/artist/4Z8Ww6Hj7o9vYv4P4DG7g3');
}

main();
