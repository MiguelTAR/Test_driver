const http = require('http');

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: Number(process.env.API_PORT || 3001),
      path,
      method,
      headers: {
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
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

  const unauthorized = await request('POST', '/api/sessions', { startedAt: Date.now() });
  if (unauthorized.status !== 401) throw new Error('Unauthenticated session creation was not rejected');

  const suffix = Date.now();
  const registered = await request('POST', '/api/auth/register', {
    fullName: 'API Integration Test',
    email: `api-test-${suffix}@example.test`,
    password: `Test-pass-${suffix}`,
  });
  if (registered.status !== 201 || !registered.body.token) {
    throw new Error(`Register failed: ${registered.status}`);
  }
  const loggedIn = await request('POST', '/api/auth/login', {
    email: registered.body.user.email,
    password: `Test-pass-${suffix}`,
  });
  if (loggedIn.status !== 200 || !loggedIn.body.token) throw new Error('Login failed');
  const token = loggedIn.body.token;
  const invalidLogin = await request('POST', '/api/auth/login', {
    email: registered.body.user.email,
    password: 'wrong-password',
  });
  if (invalidLogin.status !== 401) throw new Error('Invalid credentials were accepted');

  const sessionResponse = await request(
    'POST',
    '/api/sessions',
    { startedAt: Date.now() },
    token
  );
  if (sessionResponse.status !== 201) {
    throw new Error(`Create session failed: ${sessionResponse.status}`);
  }
  const sessionId = sessionResponse.body.id;

  const sample = {
    sessionId,
    timestamp: Date.now(),
    clientId: `integration-sample-${suffix}`,
    coords: { latitude: 43.6532, longitude: -79.3832, altitude: 120, accuracy: 5, speed: 12.5, heading: 90 },
    acceleration: { x: 0.1, y: 0.2, z: 9.8 },
  };
  const samples = await request('POST', '/api/samples', [sample], token);
  if (samples.status !== 201 || samples.body.stored !== 1) throw new Error('Store sample failed');
  const duplicateSample = await request('POST', '/api/samples', [sample], token);
  if (duplicateSample.status !== 201) throw new Error('Idempotent sample retry failed');

  const accelerationOnly = await request('POST', '/api/samples', [
    {
      sessionId,
      timestamp: sample.timestamp + 1,
      clientId: `integration-acceleration-only-${suffix}`,
      coords: {},
      acceleration: { x: 0.3, y: 0.4, z: 9.7 },
    },
  ], token);
  const gpsOnly = await request('POST', '/api/samples', [
    {
      sessionId,
      timestamp: sample.timestamp + 2,
      clientId: `integration-gps-only-${suffix}`,
      coords: { latitude: 0, longitude: 0, speed: 0 },
    },
  ], token);
  if (accelerationOnly.status !== 201 || gpsOnly.status !== 201) {
    throw new Error('Partial GPS or acceleration readings were not accepted');
  }

  const invalidReadings = await Promise.all([
    request('POST', '/api/samples', [{
      sessionId,
      timestamp: sample.timestamp + 3,
      coords: { latitude: 91, longitude: -79.3832 },
      acceleration: { x: 0, y: 0, z: 0 },
    }], token),
    request('POST', '/api/samples', [{
      sessionId,
      timestamp: sample.timestamp + 4,
      coords: { latitude: 43.6532, longitude: -79.3832, speed: -1 },
      acceleration: { x: 0, y: 0, z: 0 },
    }], token),
    request('POST', '/api/samples', [{
      sessionId,
      timestamp: null,
      coords: { latitude: 43.6532, longitude: -79.3832 },
    }], token),
    request('POST', '/api/samples', [{
      sessionId,
      timestamp: sample.timestamp + 5,
      coords: {},
      acceleration: {},
    }], token),
  ]);
  if (invalidReadings.some((result) => result.status !== 400)) {
    throw new Error('Invalid or empty telemetry readings were not rejected');
  }

  const paused = await request('POST', '/api/samples', [
    { sessionId, timestamp: Date.now(), type: 'session_paused' },
  ], token);
  if (paused.status !== 201) throw new Error('Pause session failed');

  const rejectedWhilePaused = await request('POST', '/api/samples', [
    {
      sessionId,
      timestamp: Date.now(),
      coords: { latitude: 43.6532, longitude: -79.3832, speed: 4.2 },
    },
  ], token);
  if (rejectedWhilePaused.status !== 409) {
    throw new Error('Telemetry was accepted for a paused session');
  }

  const resumed = await request('POST', '/api/samples', [
    { sessionId, timestamp: Date.now(), type: 'session_resumed' },
  ], token);
  if (resumed.status !== 201) throw new Error('Resume session failed');

  const ended = await request('POST', '/api/samples', [
    { sessionId, timestamp: Date.now(), type: 'session_ended' },
  ], token);
  if (ended.status !== 201) throw new Error('End session failed');

  const retrieved = await request('GET', `/api/sessions/${sessionId}`, undefined, token);
  const retrievedSample = retrieved.body.samples.find(
    (item) => Number(item.speed) === 12.5
  );
  const retrievedAccelerationOnly = retrieved.body.samples.find(
    (item) => Number(item.accelerationZ) === 9.7
  );
  const retrievedGpsOnly = retrieved.body.samples.find(
    (item) =>
      item.latitude !== null &&
      item.longitude !== null &&
      Number(item.latitude) === 0 &&
      Number(item.longitude) === 0
  );
  const retrievalChecks = {
    status: retrieved.status,
    sampleCount: retrieved.body.samples.length,
    latitude: retrievedSample && Number(retrievedSample.latitude),
    longitude: retrievedSample && Number(retrievedSample.longitude),
    recordedAt: retrievedSample && new Date(retrievedSample.recordedAt).getTime(),
    expectedRecordedAt: sample.timestamp,
    accelerationZ: retrievedSample && Number(retrievedSample.accelerationZ),
    accelerationOnlyLatitude: retrievedAccelerationOnly && retrievedAccelerationOnly.latitude,
    gpsOnlyAccelerationX: retrievedGpsOnly && retrievedGpsOnly.accelerationX,
    sessionStatus: retrieved.body.status,
    endedAt: retrieved.body.endedAt,
    userId: retrieved.body.userId,
    expectedUserId: registered.body.user.id,
  };
  if (
    retrieved.status !== 200 ||
    retrieved.body.samples.length !== 3 ||
    !retrievedSample ||
    Number(retrievedSample.latitude) !== 43.6532 ||
    Number(retrievedSample.longitude) !== -79.3832 ||
    new Date(retrievedSample.recordedAt).getTime() !== sample.timestamp ||
    Number(retrievedSample.accelerationZ) !== 9.8 ||
    !retrievedAccelerationOnly ||
    retrievedAccelerationOnly.latitude !== null ||
    !retrievedGpsOnly ||
    retrievedGpsOnly.accelerationX !== null ||
    retrieved.body.status !== 'completed' ||
    !retrieved.body.endedAt ||
    retrieved.body.userId !== registered.body.user.id
  ) {
    throw new Error(
      `Retrieve/ownership/session completion check failed: ${JSON.stringify(retrievalChecks)}`
    );
  }

  const secondUser = await request('POST', '/api/auth/register', {
    fullName: 'Other API Test',
    email: `api-test-other-${suffix}@example.test`,
    password: `Other-pass-${suffix}`,
  });
  if (secondUser.status !== 201 || !secondUser.body.token) {
    throw new Error('Second test account registration failed');
  }
  const inaccessible = await request(
    'GET',
    `/api/sessions/${sessionId}`,
    undefined,
    secondUser.body.token
  );
  if (inaccessible.status !== 404) throw new Error('Another user could access the session');
  const crossUserWrite = await request('POST', '/api/samples', [
    { sessionId, timestamp: Date.now(), type: 'session_ended' },
  ], secondUser.body.token);
  if (crossUserWrite.status !== 404) throw new Error('Another user could modify the session');

  const pausedSessionResponse = await request(
    'POST',
    '/api/sessions',
    { startedAt: Date.now() },
    token
  );
  const pausedSessionId = pausedSessionResponse.body.id;
  const pauseSecondSession = await request('POST', '/api/samples', [
    { sessionId: pausedSessionId, timestamp: Date.now(), type: 'session_paused' },
  ], token);
  const endPausedSession = await request('POST', '/api/samples', [
    { sessionId: pausedSessionId, timestamp: Date.now(), type: 'session_ended' },
  ], token);
  const pausedSession = await request(
    'GET',
    `/api/sessions/${pausedSessionId}`,
    undefined,
    token
  );
  if (
    pauseSecondSession.status !== 201 ||
    endPausedSession.status !== 201 ||
    pausedSession.body.status !== 'completed' ||
    !pausedSession.body.endedAt
  ) {
    throw new Error('Ending a paused session failed');
  }

  const offlineSessionId = `offline-${suffix}`;
  const offlineBatch = [
    {
      sessionId: offlineSessionId,
      timestamp: Date.now(),
      clientId: `offline-start-${suffix}`,
      type: 'session_started',
    },
    {
      sessionId: offlineSessionId,
      timestamp: Date.now() + 1,
      clientId: `offline-sample-${suffix}`,
      coords: { latitude: 43.6532, longitude: -79.3832, speed: 8.5 },
      acceleration: { x: 0.3, y: 0.4, z: 9.7 },
    },
    {
      sessionId: offlineSessionId,
      timestamp: Date.now() + 2,
      clientId: `offline-end-${suffix}`,
      type: 'session_ended',
    },
  ];
  const offlineStored = await request('POST', '/api/samples', offlineBatch, token);
  const offlineRetry = await request('POST', '/api/samples', offlineBatch, token);
  const offlineRetrieved = await request(
    'GET',
    `/api/sessions/${offlineSessionId}`,
    undefined,
    token
  );
  if (
    offlineStored.status !== 201 ||
    offlineRetry.status !== 201 ||
    offlineRetrieved.body.status !== 'completed' ||
    offlineRetrieved.body.samples.length !== 1 ||
    offlineRetrieved.body.userId !== registered.body.user.id ||
    !offlineRetrieved.body.events.some((event) => event.eventType === 'started')
  ) {
    throw new Error('Offline session replay or idempotency check failed');
  }

  console.log(JSON.stringify({
    health,
    authenticatedUser: registered.body.user.email,
    session: {
      id: retrieved.body.id,
      userId: retrieved.body.userId,
      status: retrieved.body.status,
      endedAt: retrieved.body.endedAt,
      sampleCount: retrieved.body.samples.length,
      eventTypes: retrieved.body.events.map((event) => event.eventType),
    },
    pausedSessionEnd: pausedSession.body.status,
    offlineSessionReplay: 'passed',
    ownershipCheck: 'passed',
  }, null, 2));
})();
