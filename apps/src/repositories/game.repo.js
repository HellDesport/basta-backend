// src/repositories/game.repo.js
import { q, pool } from "./db.js";

/* =======================================================
   CREAR JUEGO (con límites + current_round)
======================================================= */
export async function createGame({ code, pointLimit, roundLimit }) {
  const [res] = await pool.query(
    `INSERT INTO game (code, status, point_limit, round_limit, current_round)
     VALUES (?, 'lobby', ?, ?, 0)`,
    [code, pointLimit, roundLimit]
  );

  const rows = await q(`SELECT * FROM game WHERE id = ?`, [res.insertId]);
  return rows[0];
}

/* =======================================================
   BUSCAR JUEGO POR CÓDIGO
======================================================= */
export async function getGameByCode(code) {
  const rows = await q(
    `SELECT * FROM game WHERE code = ? LIMIT 1`,
    [code]
  );
  return rows[0] || null;
}

/* =======================================================
   BUSCAR JUEGO POR ID
======================================================= */
export async function getGameById(id) {
  const rows = await q(
    `SELECT * FROM game WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

/* =======================================================
   AGREGAR JUGADOR (sin duplicados + normalizado)
======================================================= */
export async function addPlayer(gameId, name, isHost = false) {
  const cleanName = name.trim();

  // evitar duplicados
  const [existing] = await q(
    `SELECT * FROM player WHERE game_id = ? AND name = ? LIMIT 1`,
    [gameId, cleanName]
  );

  if (existing) return existing;

  const [res] = await pool.query(
    `INSERT INTO player (game_id, name, is_host, score)
     VALUES (?, ?, ?, 0)`,
    [gameId, cleanName, isHost ? 1 : 0]
  );

  const [p] = await q(`SELECT * FROM player WHERE id = ?`, [res.insertId]);
  return p;
}

/* =======================================================
   REMOVER JUGADOR
======================================================= */
export async function removePlayer(gameId, playerId) {
  await q(
    `DELETE FROM player WHERE id = ? AND game_id = ?`,
    [playerId, gameId]
  );
}

/* =======================================================
   LISTAR JUGADORES
======================================================= */
export async function listPlayers(gameId) {
  return q(
    `SELECT id, name, is_host, score
       FROM player
      WHERE game_id = ?
      ORDER BY is_host DESC, name ASC`,
    [gameId]
  );
}

/* =======================================================
   ACTUALIZAR CAMPOS DEL JUEGO
======================================================= */
export async function updateGame(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;

  const vals = Object.values(fields);
  const set = keys.map(k => `${k} = ?`).join(",");

  await q(`UPDATE game SET ${set} WHERE id = ?`, [...vals, id]);
}

/* =======================================================
   SUMAR PUNTAJE
======================================================= */
export async function addScoreToPlayer(gameId, playerId, add) {
  await q(
    `UPDATE player
        SET score = COALESCE(score, 0) + ?
      WHERE id = ? AND game_id = ?`,
    [add, playerId, gameId]
  );
}

/* =======================================================
   OBTENER SCORES
======================================================= */
export async function getScores(gameId) {
  return await q(
    `SELECT 
        p.id,
        p.name,
        COALESCE(p.score, 0) AS total
     FROM player p
     WHERE p.game_id = ?
     ORDER BY total DESC`,
    [gameId]
  );
}

/* =======================================================
   🔥 OBTENER current_round
======================================================= */
export async function getCurrentRound(gameId) {
  const rows = await q(
    `SELECT current_round FROM game WHERE id = ?`,
    [gameId]
  );
  return rows[0]?.current_round ?? 0;
}

/* =======================================================
   🔥 INCREMENTAR current_round
======================================================= */
export async function incrementRoundNumber(gameId) {
  await q(
    `UPDATE game
        SET current_round = COALESCE(current_round, 0) + 1
      WHERE id = ?`,
    [gameId]
  );
}

/* =======================================================
   LISTAR TODOS LOS JUEGOS (watchdog)
======================================================= */
export async function getAllGames() {
  return q(`
    SELECT id, code, status, point_limit, round_limit, current_round
      FROM game
  `);
}

/* =======================================================
   ELIMINAR JUEGO COMPLETO
======================================================= */
export async function deleteGame(gameId) {
  await q(`
    DELETE FROM submission
     WHERE round_id IN (SELECT id FROM round WHERE game_id = ?)
  `, [gameId]);

  await q(`DELETE FROM round WHERE game_id = ?`, [gameId]);
  await q(`DELETE FROM player WHERE game_id = ?`, [gameId]);
  await q(`DELETE FROM game_category WHERE game_id = ?`, [gameId]);
  await q(`DELETE FROM game WHERE id = ?`, [gameId]);
}
