DROP TABLE IF EXISTS dictionary;

CREATE TABLE dictionary (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  
  word VARCHAR(100) NOT NULL,
  category_slug VARCHAR(50) NOT NULL,
  locale VARCHAR(10) NOT NULL DEFAULT 'es',
  
  status ENUM('valid', 'invalid') NOT NULL DEFAULT 'valid',

  created_by INT NULL,
  reviewed_by INT NULL,

  notes VARCHAR(255) NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_word (word),
  INDEX idx_category (category_slug),
  INDEX idx_locale (locale),
  INDEX idx_status (status)
);
