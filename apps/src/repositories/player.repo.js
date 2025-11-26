// src/repositories/player.repo.js
import { q } from "./db.js";

export async function removePlayer(playerId) {
  await q(`DELETE FROM player WHERE id = ?`, [playerId]);
}

export async function countPlayersInGame(gameId) {
  const rows = await q(
    `SELECT COUNT(*) AS c FROM player WHERE game_id = ?`,
    [gameId]
  );
  return rows[0].c;
}
