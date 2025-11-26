// src/repositories/category.repo.js
import { q, pool } from './db.js';

/**
 * Normaliza el texto para placeholders.
 */
function makePlaceholder(name, slug) {
  const base = slug || name || '';
  const clean = base.toString().trim().toLowerCase();
  return `Escribe una ${clean}`;
}

/**
 * Categorías por defecto usadas al crear la partida
 */
export async function getDefaults() {
  const rows = await q(
    `SELECT id, slug, name
       FROM category
      WHERE is_default = 1 AND enabled = 1
      ORDER BY id`
  );

  return rows.map(c => ({
    ...c,
    placeholder: makePlaceholder(c.name, c.slug)
  }));
}

/**
 * Asociar categorías a un juego
 */
export async function attachToGame(gameId, categoryIds = []) {
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
    return listByGame(gameId);
  }

  const values = categoryIds.map((cid, i) => [gameId, cid, i + 1]);

  await pool.query(
    `INSERT IGNORE INTO game_category (game_id, category_id, position)
     VALUES ?`,
    [values]
  );

  return listByGame(gameId);
}

/**
 * Categorías asociadas al juego
 */
export async function listByGame(gameId) {
  const rows = await q(
    `SELECT c.id, c.slug, c.name, gc.position
       FROM game_category gc
       JOIN category c ON c.id = gc.category_id
      WHERE gc.game_id = ?
      ORDER BY gc.position`,
    [gameId]
  );

  return rows.map(c => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    position: c.position,
    placeholder: makePlaceholder(c.name, c.slug)
  }));
}
