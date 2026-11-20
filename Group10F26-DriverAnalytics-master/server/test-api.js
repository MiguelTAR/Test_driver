const http = require('http');

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: Number(process.env.API_PORT || 3001),
      path,
      method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
    }, (res) => {
      let result = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { result += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(result || '{}') }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  const health = await request('GET', '/api/health');
  if (health.status !== 200 || !health.body.ok) throw new Error('Health check failed');

  const sessionId = `test-session-${Date.now()}`;
  const created = await request('POST', '/api/sessions', { id: sessionId, startedAt: Date.now() });
  if (created.status !== 201) throw new Error(`Create session failed: ${created.status}`);

  const samples = await request('POST', '/api/samples', [
    {
      sessionId,
      timestamp: Date.now(),
      coords: { latitude: 43.6532, longitude: -79.3832, altitude: 120, accuracy: 5, speed: 12.5, heading: 90 },
      acceleration: { x: 0.1, y: 0.2, z: 9.8 },
    },
  ]);
  if (samples.status !== 201 || samples.body.stored !== 1) throw new Error('Store sample failed');

  const retrieved = await request('GET', `/api/sessions/${sessionId}`);
  if (retrieved.status !== 200 || retrieved.body.samples.length !== 1) throw new Error('Retrieve sample failed');
  console.log(JSON.stringify({ health, created, samples, retrieved }, null, 2));
})();
