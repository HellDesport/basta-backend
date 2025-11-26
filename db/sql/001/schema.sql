CREATE TABLE IF NOT EXISTS game (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  code CHAR(6) NOT NULL UNIQUE,
  status ENUM('lobby','running','ended') NOT NULL DEFAULT 'lobby',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS player (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  game_id BIGINT NOT NULL,
  name VARCHAR(64) NOT NULL,
  is_host BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES game(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS category (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  slug VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(64) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS game_category (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  game_id BIGINT NOT NULL,
  category_id BIGINT NOT NULL,
  position INT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES game(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE RESTRICT,
  UNIQUE KEY uniq_game_cat (game_id, category_id)
);

CREATE TABLE IF NOT EXISTS round (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  game_id BIGINT NOT NULL,
  letter CHAR(1) NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  duration_sec INT NOT NULL,
  FOREIGN KEY (game_id) REFERENCES game(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dictionary (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  word VARCHAR(128) NOT NULL,
  category_slug VARCHAR(64) NULL,
  locale VARCHAR(8) NOT NULL DEFAULT 'es',
  status ENUM('approved','pending','rejected') NOT NULL DEFAULT 'approved',
  created_by BIGINT NULL,
  reviewed_by BIGINT NULL,
  notes VARCHAR(255) NULL,
  UNIQUE KEY uniq_word_cat (word, category_slug)
);

CREATE TABLE IF NOT EXISTS submission (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  round_id BIGINT NOT NULL,
  player_id BIGINT NOT NULL,
  category_id BIGINT NOT NULL,
  raw_text VARCHAR(128) NOT NULL,
  normalized_text VARCHAR(128) NOT NULL,
  is_valid_letter BOOLEAN NOT NULL DEFAULT FALSE,
  is_valid_category BOOLEAN NOT NULL DEFAULT FALSE,
  dictionary_id BIGINT NULL,
  orthography_score TINYINT NULL,
  repetition_group_hash CHAR(64) NULL,
  status ENUM('pending','valid','invalid') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (round_id) REFERENCES round(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE RESTRICT,
  FOREIGN KEY (dictionary_id) REFERENCES dictionary(id) ON DELETE SET NULL,
  KEY idx_dup (round_id, category_id, normalized_text),
  KEY idx_rep (round_id, repetition_group_hash)
);

CREATE TABLE IF NOT EXISTS score (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  round_id BIGINT NOT NULL,
  player_id BIGINT NOT NULL,
  points_base INT NOT NULL DEFAULT 0,
  points_unique INT NOT NULL DEFAULT 0,
  points_bonus INT NOT NULL DEFAULT 0,
  points_penalty INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  FOREIGN KEY (round_id) REFERENCES round(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_round_player (round_id, player_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  entity VARCHAR(32) NOT NULL,
  entity_id BIGINT NOT NULL,
  action VARCHAR(32) NOT NULL,
  payload_json JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  by_player BIGINT NULL
);

-- Seeds categorías por defecto
INSERT IGNORE INTO category (slug, name, is_default, enabled) VALUES
('nombre','Nombre',1,1),
('apellido','Apellido',1,1),
('animal','Animal',1,1),
('pais','País',1,1),
('fruta','Fruta',0,1),
('color','Color',0,1),
('cosa','Cosa',0,1),
('ciudad','Ciudad',0,1);
