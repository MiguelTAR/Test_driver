require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret === 'replace_with_a_random_64_character_secret') {
  throw new Error('Set JWT_SECRET in .env to a random secret before starting the API.');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

async function initializeDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  for (const statement of schema.split(/;\s*(?:\r?\n|$)/).filter((part) => part.trim())) {
    await pool.query(statement);
  }
  await pool.query(
    "ALTER TABLE driving_sessions MODIFY status ENUM('active', 'paused', 'completed') NOT NULL DEFAULT 'active'"
  );
  await pool.query(
    "ALTER TABLE session_events MODIFY event_type ENUM('gps_lost', 'gps_restored', 'started', 'paused', 'resumed', 'completed') NOT NULL"
  );
  for (const [table, indexName] of [
    ['telemetry_samples', 'uq_samples_client_id'],
    ['session_events', 'uq_events_client_id'],
  ]) {
    const [columns] = await pool.query(
      'SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
      [table, 'client_id']
    );
    if (!columns.length) {
      await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN client_id VARCHAR(64) NULL`);
    }

    const [indexes] = await pool.query(
      'SELECT INDEX_NAME FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?',
      [table, indexName]
    );
    if (!indexes.length) {
      await pool.query(`ALTER TABLE \`${table}\` ADD UNIQUE KEY \`${indexName}\` (client_id)`);
    }
  }
}

function issueToken(userId) {
  return jwt.sign({ sub: userId }, jwtSecret, { expiresIn: '7d' });
}

function requireAuth(req, res, next) {
  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication is required.' });
  }

  try {
    const claims = jwt.verify(token, jwtSecret);
    if (typeof claims === 'string' || typeof claims.sub !== 'string') {
      return res.status(401).json({ error: 'Invalid authentication token.' });
    }
    req.userId = claims.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

function inputError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function parseTimestamp(value) {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && !value.trim()) ||
    (typeof value === 'number' && !Number.isFinite(value))
  ) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function optionalNumber(value, name, { min = -Infinity, max = Infinity } = {}) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw inputError(`${name} must be a finite number between ${min} and ${max}.`);
  }
  return value;
}

function parseTelemetry(item) {
  const coords = item.coords ?? {};
  const acceleration = item.acceleration ?? {};
  if (
    typeof coords !== 'object' ||
    Array.isArray(coords) ||
    typeof acceleration !== 'object' ||
    Array.isArray(acceleration)
  ) {
    throw inputError('coords and acceleration must be objects when provided.');
  }

  const hasLatitude = coords.latitude !== undefined && coords.latitude !== null;
  const hasLongitude = coords.longitude !== undefined && coords.longitude !== null;
  if (hasLatitude !== hasLongitude) {
    throw inputError('Latitude and longitude must both be provided for a GPS fix.');
  }

  const readings = {
    latitude: optionalNumber(coords.latitude, 'latitude', { min: -90, max: 90 }),
    longitude: optionalNumber(coords.longitude, 'longitude', { min: -180, max: 180 }),
    altitude: optionalNumber(coords.altitude, 'altitude'),
    accuracy: optionalNumber(coords.accuracy, 'accuracy', { min: 0 }),
    speed: optionalNumber(coords.speed, 'speed', { min: 0 }),
    heading: optionalNumber(coords.heading, 'heading', { min: 0, max: 360 }),
    accelerationX: optionalNumber(acceleration.x, 'acceleration.x'),
    accelerationY: optionalNumber(acceleration.y, 'acceleration.y'),
    accelerationZ: optionalNumber(acceleration.z, 'acceleration.z'),
  };

  if (Object.values(readings).every((reading) => reading === null)) {
    throw inputError('A telemetry sample must contain at least one GPS or acceleration reading.');
  }
  return readings;
}

app.get('/api/health', async (_req, res) => {
  const [rows] = await pool.query('SELECT 1 AS ok');
  res.json({ ok: rows[0].ok === 1 });
});

app.post('/api/auth/register', async (req, res) => {
  const fullName = String(req.body.fullName || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!fullName || !email || password.length < 8) {
    return res.status(400).json({ error: 'Full name, valid email, and an 8-character password are required.' });
  }

  try {
    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);
    await pool.execute(
      'INSERT INTO users (id, full_name, email, password_hash) VALUES (?, ?, ?, ?)',
      [id, fullName, email, passwordHash]
    );
    res.status(201).json({
      user: { id, fullName, email },
      token: issueToken(id),
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
    throw error;
  }
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const [rows] = await pool.execute(
    'SELECT id, full_name, email, password_hash FROM users WHERE email = ?',
    [email]
  );

  if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  res.json({
    user: {
      id: rows[0].id,
      fullName: rows[0].full_name,
      email: rows[0].email,
    },
    token: issueToken(rows[0].id),
  });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id, full_name AS fullName, email FROM users WHERE id = ?',
    [req.userId]
  );
  if (!rows.length) return res.status(401).json({ error: 'User account no longer exists.' });
  res.json(rows[0]);
});

app.post('/api/sessions', requireAuth, async (req, res) => {
  const startedAt = req.body.startedAt ? new Date(req.body.startedAt) : new Date();
  const requestedId = String(req.body.id || '').trim();
  if (Number.isNaN(startedAt.getTime()) || requestedId.length > 36) {
    return res.status(400).json({ error: 'A valid session id and startedAt value are required.' });
  }

  const id = requestedId || crypto.randomUUID();
  await pool.execute(
    'INSERT INTO driving_sessions (id, user_id, started_at) VALUES (?, ?, ?)',
    [id, req.userId, startedAt]
  );
  res.status(201).json({ id });
});

app.post('/api/samples', requireAuth, async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : req.body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'A non-empty items array is required.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let stored = 0;

    for (const item of items) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw inputError('Each item must be an object.');
      }
      const sessionId = String(item.sessionId || '').trim();
      const timestamp = parseTimestamp(item.timestamp);
      if (!sessionId || sessionId.length > 36 || !timestamp) {
        throw inputError('Every item requires a sessionId (up to 36 characters) and valid timestamp.');
      }
      if (
        item.clientId !== undefined &&
        item.clientId !== null &&
        (typeof item.clientId !== 'string' || !item.clientId || item.clientId.length > 64)
      ) {
        throw inputError('clientId must be a non-empty string of at most 64 characters.');
      }
      const supportedTypes = [
        'session_started',
        'session_paused',
        'session_resumed',
        'session_ended',
        'gps_lost',
        'gps_restored',
      ];
      if (item.type !== undefined && item.type !== null && !supportedTypes.includes(item.type)) {
        throw inputError('Unsupported telemetry item type.');
      }

      if (item.type === 'session_started') {
        const [existing] = await connection.execute(
          'SELECT user_id FROM driving_sessions WHERE id = ? FOR UPDATE',
          [sessionId]
        );
        if (existing.length) {
          if (existing[0].user_id !== req.userId) {
            const error = new Error('Session not found.');
            error.status = 404;
            throw error;
          }
          stored++;
          continue;
        }
        await connection.execute(
          'INSERT INTO driving_sessions (id, user_id, started_at) VALUES (?, ?, ?)',
          [sessionId, req.userId, timestamp]
        );
        await connection.execute(
          'INSERT INTO session_events (client_id, session_id, event_type, recorded_at) VALUES (?, ?, ?, ?)',
          [item.clientId || null, sessionId, 'started', timestamp]
        );
        stored++;
        continue;
      }

      const [sessions] = await connection.execute(
        'SELECT status FROM driving_sessions WHERE id = ? AND user_id = ? FOR UPDATE',
        [sessionId, req.userId]
      );
      if (!sessions.length) {
        const error = new Error('Session not found.');
        error.status = 404;
        throw error;
      }
      const sessionStatus = sessions[0].status;
      if (item.clientId) {
        const [existingSamples] = await connection.execute(
          'SELECT id FROM telemetry_samples WHERE session_id = ? AND client_id = ?',
          [sessionId, item.clientId]
        );
        const [existingEvents] = await connection.execute(
          'SELECT id FROM session_events WHERE session_id = ? AND client_id = ?',
          [sessionId, item.clientId]
        );
        if (existingSamples.length || existingEvents.length) {
          stored++;
          continue;
        }
      }

      if (['gps_lost', 'gps_restored', 'session_paused', 'session_resumed', 'session_ended'].includes(item.type)) {
        const lifecycle = {
          session_paused: { expected: 'active', next: 'paused', event: 'paused' },
          session_resumed: { expected: 'paused', next: 'active', event: 'resumed' },
          session_ended: { expected: ['active', 'paused'], next: 'completed', event: 'completed' },
        }[item.type];

        if (lifecycle && sessionStatus !== lifecycle.next) {
          const validCurrent = Array.isArray(lifecycle.expected)
            ? lifecycle.expected.includes(sessionStatus)
            : sessionStatus === lifecycle.expected;
          if (!validCurrent) {
            const error = new Error(`Cannot apply ${item.type} while session is ${sessionStatus}.`);
            error.status = 409;
            throw error;
          }
          await connection.execute(
            item.type === 'session_ended'
              ? 'UPDATE driving_sessions SET status = ?, ended_at = ? WHERE id = ? AND user_id = ?'
              : 'UPDATE driving_sessions SET status = ? WHERE id = ? AND user_id = ?',
            item.type === 'session_ended'
              ? [lifecycle.next, timestamp, sessionId, req.userId]
              : [lifecycle.next, sessionId, req.userId]
          );
        }

        if (lifecycle && sessionStatus === lifecycle.next) {
          stored++;
          continue;
        }

        const eventType = lifecycle ? lifecycle.event : item.type;
        await connection.execute(
          'INSERT INTO session_events (client_id, session_id, event_type, recorded_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE client_id = VALUES(client_id)',
          [item.clientId || null, sessionId, eventType, timestamp]
        );
        stored++;
        continue;
      }

      if (sessionStatus !== 'active') {
        const error = new Error(`Cannot add telemetry while session is ${sessionStatus}.`);
        error.status = 409;
        throw error;
      }
      const readings = parseTelemetry(item);
      await connection.execute(
        `INSERT INTO telemetry_samples
         (client_id, session_id, recorded_at, latitude, longitude, altitude, accuracy, speed, heading,
          acceleration_x, acceleration_y, acceleration_z)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE client_id = VALUES(client_id)`,
        [
          item.clientId || null,
          sessionId,
          timestamp,
          readings.latitude,
          readings.longitude,
          readings.altitude,
          readings.accuracy,
          readings.speed,
          readings.heading,
          readings.accelerationX,
          readings.accelerationY,
          readings.accelerationZ,
        ]
      );
      stored++;
    }

    await connection.commit();
    res.status(201).json({ stored });
  } catch (error) {
    await connection.rollback();
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    throw error;
  } finally {
    connection.release();
  }
});

app.get('/api/sessions/:id', requireAuth, async (req, res) => {
  const [sessions] = await pool.execute(
    'SELECT id, user_id AS userId, started_at AS startedAt, ended_at AS endedAt, status FROM driving_sessions WHERE id = ? AND user_id = ?',
    [req.params.id, req.userId]
  );
  if (!sessions.length) return res.status(404).json({ error: 'Session not found.' });

  const [samples] = await pool.execute(
    `SELECT recorded_at AS recordedAt, latitude, longitude, altitude, accuracy, speed, heading,
            acceleration_x AS accelerationX, acceleration_y AS accelerationY, acceleration_z AS accelerationZ
     FROM telemetry_samples WHERE session_id = ? ORDER BY recorded_at`,
    [req.params.id]
  );
  const [events] = await pool.execute(
    'SELECT event_type AS eventType, recorded_at AS recordedAt FROM session_events WHERE session_id = ? ORDER BY recorded_at',
    [req.params.id]
  );
  res.json({ ...sessions[0], samples, events });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error.' });
});

initializeDatabase()
  .then(() => {
    const port = Number(process.env.API_PORT || 3001);
    app.listen(port, '0.0.0.0', () => {
      console.log(`Driver Analytics API listening on http://0.0.0.0:${port}`);
    });
  })
  .catch((error) => {
    console.error('Database initialization failed:', error);
    process.exit(1);
  });
