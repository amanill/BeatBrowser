import fetch from 'node-fetch';

async function main() {
  console.log('Testing ListenBrainz /1/ endpoints...');
  const url_1 = 'https://api.listenbrainz.org/1/metadata/lookup/urls2msids';
  const payload = {
    urls: [
      'https://open.spotify.com/artist/4Z8Ww6Hj7o9vYv4P4DG7g3',
      'https://open.spotify.com/track/7ouMYWpwJ422j7IYvXvC6o'
    ]
  };

  try {
    const res = await fetch(url_1, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MusicMapAgent/1.0.0 (skiskiacm@gmail.com)'
      },
      body: JSON.stringify(payload)
    });
    
    console.log('Status code:', res.status);
    console.log('Response content-type:', res.headers.get('content-type'));
    const text = await res.text();
    console.log('Response text:', text.substring(0, 1000));
  } catch (err: any) {
    console.error('Error querying /1/ endpoint:', err);
  }
}

main();
