import fetch from 'node-fetch';

async function testPath(url: string, method: string = 'POST', body: any = null) {
  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MusicMapAgent/1.0.0 (skiskiacm@gmail.com)'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    console.log(`URL: ${url} [${method}] status: ${res.status}`);
    if (res.status !== 404 && res.status !== 410) {
      const text = await res.text();
      console.log(`  --> Response (truncated): ${text.substring(0, 300)}`);
    }
  } catch (err: any) {
    console.log(`URL: ${url} error: ${err.message}`);
  }
}

async function main() {
  const payload = {
    urls: [
      'https://open.spotify.com/artist/4Z8Ww6Hj7o9vYv4P4DG7g3',
      'https://open.spotify.com/track/7ouMYWpwJ422j7IYvXvC6o'
    ]
  };

  const domain = 'https://api.listenbrainz.org';

  const paths = [
    '/v1/metadata/lookup/',
    '/v1/metadata/lookup',
    '/v1/metadata/lookup/urls',
    '/1/metadata/lookup/urls',
    '/v1/metadata/urls',
    '/1/metadata/urls',
    '/1/metadata/lookup/spotify',
    '/1/metadata/lookup/spotify/urls'
  ];

  for (const path of paths) {
    await testPath(`${domain}${path}`, 'POST', payload);
    await testPath(`${domain}${path}`, 'GET');
  }
}

main();
