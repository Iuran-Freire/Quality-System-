// Parte inicial da tabela NBR 5426 / AQL

// src/utils/sampling/nbr5426_table.js
// Tabela NBR 5426 / AQL
// Responsabilidade: Code Letter + AQL => Ac/Re
//
// AQLs usados no plano antigo:
// 0.1 / 0.15 / 0.25 / 0.4 / 0.65 / 1.0
//
// Observação:
// Esta tabela está estruturada para o sistema calcular Ac/Re.
// Antes de usar oficialmente em produção, valide os valores com a tabela NBR 5426 oficial da empresa.

import { AQL_TABLE_REDUCED } from "./nbr5426_atenuada_table";
import { AQL_TABLE_TIGHTENED } from "./nbr5426_severa_table";
export const NBR_REGIME_TABLES_READY = true;

export const CODE_ORDER = [
  "A", "B", "C", "D", "E", "F", "G", "H",
  "J", "K", "L", "M", "N", "P", "Q", "R","S"
];

export const SAMPLE_SIZE_BY_CODE_NORMAL = {
  A: 2,
  B: 3,
  C: 5,
  D: 8,
  E: 13,
  F: 20,
  G: 32,
  H: 50,
  J: 80,
  K: 125,
  L: 200,
  M: 315,
  N: 500,
  P: 800,
  Q: 1250,
  R: 2000,
};

export const SAMPLE_SIZE_BY_CODE_REDUCED = {
  A: 2,
  B: 2,
  C: 2,
  D: 3,
  E: 5,
  F: 8,
  G: 13,
  H: 20,
  J: 32,
  K: 50,
  L: 80,
  M: 125,
  N: 200,
  P: 315,
  Q: 500,
  R: 800,
};

export const SAMPLE_SIZE_BY_CODE_TIGHTENED = {
  A: 2,
  B: 3,
  C: 5,
  D: 8,
  E: 13,
  F: 20,
  G: 32,
  H: 50,
  J: 80,
  K: 125,
  L: 200,
  M: 315,
  N: 500,
  P: 800,
  Q: 1250,
  R: 2000,
  S: 3150,
};

// Mantém compatibilidade com o cálculo Normal já existente.
export const SAMPLE_SIZE_BY_CODE = SAMPLE_SIZE_BY_CODE_NORMAL;

export function getSampleSizeByRegime(regime = "normal") {
  const value = String(regime || "normal").trim().toLowerCase();

  if (value === "atenuada") {
    return SAMPLE_SIZE_BY_CODE_REDUCED;
  }

  if (value === "severa") {
    return SAMPLE_SIZE_BY_CODE_TIGHTENED;
  }

  return SAMPLE_SIZE_BY_CODE_NORMAL;
}

export const AQL_TABLE_NORMAL = {
  A: {
    0.1: { ac: 0, re: 1 },
    0.15: { ac: 0, re: 1 },
    0.25: { ac: 0, re: 1 },
    0.4: { ac: 0, re: 1 },
    0.65: { ac: 0, re: 1 },
    1.0: { ac: 0, re: 1 },
  },

  B: {
    0.1: { ac: 0, re: 1 },
    0.15: { ac: 0, re: 1 },
    0.25: { ac: 0, re: 1 },
    0.4: { ac: 0, re: 1 },
    0.65: { ac: 0, re: 1 },
    1.0: { ac: 0, re: 1 },
  },

  C: {
    0.1: { ac: 0, re: 1 },
    0.15: { ac: 0, re: 1 },
    0.25: { ac: 0, re: 1 },
    0.4: { ac: 0, re: 1 },
    0.65: { ac: 0, re: 1 },
    1.0: { ac: 0, re: 1 },
  },

  D: {
    0.1: { ac: 0, re: 1 },
    0.15: { ac: 0, re: 1 },
    0.25: { ac: 0, re: 1 },
    0.4: { ac: 0, re: 1 },
    0.65: { ac: 0, re: 1 },
    1.0: { ac: 0, re: 1 },
  },

  E: {
    0.1: { ac: 0, re: 1 },
    0.15: { ac: 0, re: 1 },
    0.25: { ac: 0, re: 1 },
    0.4: { ac: 0, re: 1 },
    0.65: { ac: 0, re: 1 },
    1.0: { ac: 0, re: 1 },
  },

  F: {
    0.1: { ac: 0, re: 1 },
    0.15: { ac: 0, re: 1 },
    0.25: { ac: 0, re: 1 },
    0.4: { ac: 0, re: 1 },
    0.65: { ac: 0, re: 1 },
    1.0: { ac: 0, re: 1 },
  },

  G: {
    0.1: { ac: 0, re: 1 },
    0.15: { ac: 0, re: 1 },
    0.25: { ac: 0, re: 1 },
    0.4: { ac: 0, re: 1 },
    0.65: { ac: 0, re: 1 },
    1.0: { ac: 1, re: 2 },
  },

  H: {
    0.1: { ac: 0, re: 1 },
    0.15: { ac: 0, re: 1 },
    0.25: { ac: 0, re: 1 },
    0.4: { ac: 0, re: 1 },
    0.65: { ac: 1, re: 2 },
    1.0: { ac: 1, re: 2 },
  },

  J: {
  0.1: { ac: 0, re: 1 },
  0.15: { ac: 0, re: 1 },
  0.25: { ac: 0, re: 1 },

  // Na tabela oficial, J + AQL 0.4 possui seta para baixo.
// O sistema localizará automaticamente o primeiro plano válido abaixo.
  0.4: { arrow: "down" },

  0.65: { ac: 1, re: 2 },
  1.0: { ac: 2, re: 3 },
},

  K: {
    0.1: { ac: 0, re: 1 },
    0.15: { ac: 0, re: 1 },
    0.25: { ac: 1, re: 2 },
    0.4: { ac: 1, re: 2 },
    0.65: { ac: 2, re: 3 },
    1.0: { ac: 3, re: 4 },
  },

  L: {
    0.1: { ac: 0, re: 1 },
    0.15: { ac: 1, re: 2 },
    0.25: { ac: 1, re: 2 },
    0.4: { ac: 2, re: 3 },
    0.65: { ac: 3, re: 4 },
    1.0: { ac: 5, re: 6 },
  },

  M: {
    0.1: { ac: 1, re: 2 },
    0.15: { ac: 1, re: 2 },
    0.25: { ac: 2, re: 3 },
    0.4: { ac: 3, re: 4 },
    0.65: { ac: 5, re: 6 },
    1.0: { ac: 7, re: 8 },
  },

  N: {
    0.1: { ac: 1, re: 2 },
    0.15: { ac: 2, re: 3 },
    0.25: { ac: 3, re: 4 },
    0.4: { ac: 5, re: 6 },
    0.65: { ac: 7, re: 8 },
    1.0: { ac: 10, re: 11 },
  },

  P: {
    0.1: { ac: 2, re: 3 },
    0.15: { ac: 3, re: 4 },
    0.25: { ac: 5, re: 6 },
    0.4: { ac: 7, re: 8 },
    0.65: { ac: 10, re: 11 },
    1.0: { ac: 14, re: 15 },
  },

  Q: {
    0.1: { ac: 3, re: 4 },
    0.15: { ac: 5, re: 6 },
    0.25: { ac: 7, re: 8 },
    0.4: { ac: 10, re: 11 },
    0.65: { ac: 14, re: 15 },
    1.0: { ac: 21, re: 22 },
  },

  R: {
    0.1: { ac: 5, re: 6 },
    0.15: { ac: 7, re: 8 },
    0.25: { ac: 10, re: 11 },
    0.4: { ac: 14, re: 15 },
    0.65: { ac: 21, re: 22 },
    1.0: { ac: 21, re: 22 },
  },
};

export function getAqlTableByRegime(regime = "normal") {
  const value = String(regime || "normal").trim().toLowerCase();

  if (value === "atenuada") {
    return AQL_TABLE_REDUCED;
  }

  if (value === "severa") {
    return AQL_TABLE_TIGHTENED;
  }

  return AQL_TABLE_NORMAL;
}