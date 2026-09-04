import { app, startServer } from '../server.js';
import request from 'supertest';

describe('Backend API Tests', () => {
  beforeAll(async () => {
    // Start the server in test mode (does not bind to a port or load Vite)
    await startServer(true);
  });

  it('should return null image cache for non-existent image', async () => {
    const res = await request(app).get('/api/cache/image?id=non_existent_id');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ imageUrl: null });
  });

  it('should require id parameter for image cache', async () => {
    const res = await request(app).get('/api/cache/image');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('id');
  });

  it('should set and get image cache', async () => {
    const testId = 'test_img_123';
    const testUrl = 'https://example.com/image.png';
    
    // Set cache
    const postRes = await request(app)
      .post('/api/cache/image')
      .send({ id: testId, imageUrl: testUrl });
    expect(postRes.status).toBe(200);
    expect(postRes.body.status).toBe('success');

    // Get cache
    const getRes = await request(app).get(`/api/cache/image?id=${testId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.imageUrl).toBe(testUrl);
  });
});
