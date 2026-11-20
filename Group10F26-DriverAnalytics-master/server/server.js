require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { pool } = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

async function initializeDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  for (const statement of schema.split(/;\s*(?:\r?\n|$)/).filter((part) => part.trim())) {
    await pool.query(statement);
  }
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
    res.status(201).json({ id, fullName, email });
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
    id: rows[0].id,
    fullName: rows[0].full_name,
    email: rows[0].email,
  });
});

app.post('/api/sessions', async (req, res) => {
  const id = String(req.body.id || '').trim();
  const startedAt = req.body.startedAt ? new Date(req.body.startedAt) : new Date();
  if (!id || Number.isNaN(startedAt.getTime())) {
    return res.status(400).json({ error: 'Session id and a valid startedAt value are required.' });
  }

  await pool.execute(
    'INSERT INTO driving_sessions (id, started_at) VALUES (?, ?)\n     ON DUPLICATE KEY UPDATE started_at = VALUES(started_at)',
    [id, startedAt]
  );
  res.status(201).json({ id });
});

app.post('/api/samples', async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : req.body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'A non-empty items array is required.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let stored = 0;

    for (const item of items) {
      const sessionId = String(item.sessionId || '').trim();
      if (!sessionId) continue;

      if (item.type === 'gps_lost' || item.type === 'gps_restored') {
        await connection.execute(
          'INSERT IGNORE INTO driving_sessions (id, started_at) VALUES (?, ?)',
          [sessionId, new Date(item.timestamp || Date.now())]
        );
        await connection.execute(
          'INSERT INTO session_events (session_id, event_type, recorded_at) VALUES (?, ?, ?)',
          [sessionId, item.type, new Date(item.timestamp)]
        );
        stored++;
        continue;
      }

      await connection.execute(
        'INSERT IGNORE INTO driving_sessions (id, started_at) VALUES (?, ?)',
        [sessionId, new Date(item.timestamp)]
      );
      const coords = item.coords || {};
      const acceleration = item.acceleration || {};
      await connection.execute(
        `INSERT INTO telemetry_samples
         (session_id, recorded_at, latitude, longitude, altitude, accuracy, speed, heading,
          acceleration_x, acceleration_y, acceleration_z)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          new Date(item.timestamp),
          coords.latitude ?? null,
          coords.longitude ?? null,
          coords.altitude ?? null,
          coords.accuracy ?? null,
          coords.speed ?? null,
          coords.heading ?? null,
          acceleration.x ?? null,
          acceleration.y ?? null,
          acceleration.z ?? null,
        ]
      );
      stored++;
    }

    await connection.commit();
    res.status(201).json({ stored });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

app.get('/api/sessions/:id', async (req, res) => {
  const [sessions] = await pool.execute(
    'SELECT id, started_at AS startedAt, ended_at AS endedAt, status FROM driving_sessions WHERE id = ?',
    [req.params.id]
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
