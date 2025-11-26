// src/utils/text.js

export function normalizeWord(s = "") {
  return String(s)
    .normalize("NFD")                   // separa acentos
    .replace(/[\u0300-\u036f]/g, "")    // elimina acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, "")      // elimina todo lo que no sea letras/números/espacios/_/-
    .replace(/[\s-]+/g, "_")            // espacios o guiones → _
    .replace(/_+/g, "_")                // colapsa múltiplos ____
    .replace(/^_+|_+$/g, "");           // quita _ al inicio/fin
}

export function startsWithLetter(word = "", letter = "") {
  const n = normalizeWord(word);
  const l = normalizeWord(letter);

  if (!n || !l) return false;

  return n.startsWith(l);
}
