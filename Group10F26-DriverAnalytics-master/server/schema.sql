CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS driving_sessions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NULL,
  started_at DATETIME(3) NOT NULL,
  ended_at DATETIME(3) NULL,
  status ENUM('active', 'completed') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_sessions_user_started (user_id, started_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS telemetry_samples (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  session_id CHAR(36) NOT NULL,
  recorded_at DATETIME(3) NOT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  altitude DOUBLE NULL,
  accuracy DOUBLE NULL,
  speed DOUBLE NULL,
  heading DOUBLE NULL,
  acceleration_x DOUBLE NULL,
  acceleration_y DOUBLE NULL,
  acceleration_z DOUBLE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_samples_session FOREIGN KEY (session_id) REFERENCES driving_sessions(id) ON DELETE CASCADE,
  INDEX idx_samples_session_time (session_id, recorded_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS session_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  session_id CHAR(36) NOT NULL,
  event_type ENUM('gps_lost', 'gps_restored') NOT NULL,
  recorded_at DATETIME(3) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_events_session FOREIGN KEY (session_id) REFERENCES driving_sessions(id) ON DELETE CASCADE,
  INDEX idx_events_session_time (session_id, recorded_at)
) ENGINE=InnoDB;
