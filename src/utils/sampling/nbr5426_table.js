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

export const CODE_ORDER = [
  "A", "B", "C", "D", "E", "F", "G", "H",
  "J", "K", "L", "M", "N", "P", "Q", "R"
];

export const SAMPLE_SIZE_BY_CODE = {
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

export const AQL_TABLE = {
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

  // Na tabela oficial, J + AQL 0.4 tem seta para baixo.
  // Usa o primeiro plano abaixo: K.
  0.4: { use: "K" },

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
