// src/repositories/round.repo.js
import { q } from './db.js';

/* =======================================================
   FORMATEAR FECHA A MYSQL
======================================================= */
function toMySQLDate(dt) {
  return new Date(dt).toISOString().slice(0, 19).replace('T', ' ');
}

/* =======================================================
   CREAR RONDA
======================================================= */
export async function createRound({ gameId, letter, startsAt, endsAt, durationSec }) {

  // obtener número siguiente de ronda
  const [{ nextNum }] = await q(
    `SELECT COALESCE(MAX(number), 0) + 1 AS nextNum
       FROM round
      WHERE game_id = ?`,
    [gameId]
  );

  const sAt = toMySQLDate(startsAt);
  const eAt = toMySQLDate(endsAt);

  const result = await q(
    `INSERT INTO round 
       (game_id, letter, starts_at, ends_at, duration_sec, number, is_finished)
     VALUES (?,?,?,?,?,?,0)`,
    [gameId, letter, sAt, eAt, durationSec, nextNum]
  );

  const [round] = await q(`SELECT * FROM round WHERE id = ?`, [result.insertId]);
  return round;
}

/* =======================================================
   GET ROUND BY ID
======================================================= */
export async function getById(id) {
  const rows = await q(`SELECT * FROM round WHERE id = ?`, [id]);
  return rows[0] || null;
}

/* =======================================================
   GET ROUND BY ID AND GAME
======================================================= */
export async function getByIdAndGame({ id, gameId }) {
  const rows = await q(
    `SELECT *
       FROM round
      WHERE id = ?
        AND game_id = ?`,
    [id, gameId]
  );
  return rows[0] || null;
}

/* =======================================================
   COUNT PLAYERS IN GAME
======================================================= */
export async function countPlayersInGame(gameId) {
  const rows = await q(
    `SELECT COUNT(*) AS c 
       FROM player 
      WHERE game_id = ?`,
    [gameId]
  );
  return rows[0]?.c ?? 0;
}

/* =======================================================
   RONDA ACTIVA (AÚN NO FINALIZADA)
======================================================= */
export async function getActiveRound(gameId) {
  const rows = await q(
    `SELECT *
       FROM round
      WHERE game_id = ?
        AND is_finished = 0
        AND starts_at <= NOW()
        AND ends_at   >= NOW()
      ORDER BY number DESC
      LIMIT 1`,
    [gameId]
  );

  return rows[0] || null;
}

/* =======================================================
   RONDAS EXPIRADAS NO PROCESADAS
======================================================= */
export async function getExpiredRounds() {
  return q(
    `SELECT *
       FROM round
      WHERE is_finished = 0
        AND ends_at < NOW()
      ORDER BY id ASC`
  );
}

/* =======================================================
   MARCAR RONDA FINALIZADA
======================================================= */
export async function markFinished(roundId) {
  await q(
    `UPDATE round
        SET is_finished = 1
      WHERE id = ?`,
    [roundId]
  );
}

/* =======================================================
   CONTAR RONDAS DEL JUEGO
======================================================= */
export async function countRounds(gameId) {
  const rows = await q(
    `SELECT COUNT(*) AS total
       FROM round
      WHERE game_id = ?`,
    [gameId]
  );

  return rows[0]?.total ?? 0;
}

/* =======================================================
   OBTENER ESTADO COMPLETO DE LA RONDA (nuevo)
======================================================= */
export async function getRoundState(roundId) {
  const rows = await q(
    `SELECT id, game_id, number, letter,
            starts_at, ends_at,
            duration_sec,
            is_finished
       FROM round
      WHERE id = ?`,
    [roundId]
  );
  return rows[0] || null;
}


/* =======================================================
   OBTENER CATEGORÍAS DE LA RONDA
======================================================= */
export async function getCategoriesOfRound(roundId) {
  const rows = await q(
    `SELECT c.id, c.name, c.slug
       FROM round r
       JOIN game_category gc ON gc.game_id = r.game_id
       JOIN category c ON c.id = gc.category_id
      WHERE r.id = ?`,
    [roundId]
  );

  return rows;
}
