import fetch from 'node-fetch';

async function testPath(url: string, method: string = 'GET', queryParams: any = null) {
  try {
    const fullUrl = queryParams ? `${url}?${new URLSearchParams(queryParams).toString()}` : url;
    const res = await fetch(fullUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MusicMapAgent/1.0.0 (skiskiacm@gmail.com)'
      }
    });
    console.log(`URL: ${fullUrl} [${method}] status: ${res.status}`);
    const text = await res.text();
    console.log(`  --> Response (truncated): ${text.substring(0, 300)}`);
  } catch (err: any) {
    console.log(`URL: ${url} error: ${err.message}`);
  }
}

async function main() {
  // Test with and without trailing slash, with query parameters for artist and recording
  const params = {
    artist_name: 'Daft Punk',
    recording_name: 'One More Time'
  };

  console.log('Testing with and without trailing slash:');
  await testPath('https://api.listenbrainz.org/1/metadata/lookup/', 'GET', params);
  await testPath('https://api.listenbrainz.org/1/metadata/lookup', 'GET', params);
}

main();
