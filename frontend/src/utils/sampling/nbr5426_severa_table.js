// NBR 5426 — Tabela 3
// Plano de amostragem simples — Severa
//
// Fonte: IGQ-002, página 6, Tabela 3.
//
// AQLs usados pelo sistema:
// 0.10 | 0.15 | 0.25 | 0.40 | 0.65 | 1.0
//
// arrow: "down" = usar o primeiro plano abaixo
// arrow: "up" = usar o primeiro plano acima

const DOWN = { arrow: "down" };
const UP = { arrow: "up" };

const plan = (ac, re) => ({
  ac,
  re,
  returnToNormalOnDelta: false,
});

export const AQL_TABLE_TIGHTENED = {
  A: {
    0.1: DOWN,
    0.15: DOWN,
    0.25: DOWN,
    0.4: DOWN,
    0.65: DOWN,
    1.0: DOWN,
  },

  B: {
    0.1: DOWN,
    0.15: DOWN,
    0.25: DOWN,
    0.4: DOWN,
    0.65: DOWN,
    1.0: DOWN,
  },

  C: {
    0.1: DOWN,
    0.15: DOWN,
    0.25: DOWN,
    0.4: DOWN,
    0.65: DOWN,
    1.0: DOWN,
  },

  D: {
    0.1: DOWN,
    0.15: DOWN,
    0.25: DOWN,
    0.4: DOWN,
    0.65: DOWN,
    1.0: DOWN,
  },

  E: {
    0.1: DOWN,
    0.15: DOWN,
    0.25: DOWN,
    0.4: DOWN,
    0.65: DOWN,
    1.0: DOWN,
  },

  F: {
    0.1: DOWN,
    0.15: DOWN,
    0.25: DOWN,
    0.4: DOWN,
    0.65: DOWN,
    1.0: plan(0, 1),
  },

  G: {
    0.1: DOWN,
    0.15: DOWN,
    0.25: DOWN,
    0.4: DOWN,
    0.65: plan(0, 1),
    1.0: DOWN,
  },

  H: {
    0.1: DOWN,
    0.15: DOWN,
    0.25: DOWN,
    0.4: plan(0, 1),
    0.65: DOWN,
    1.0: DOWN,
  },

  J: {
    0.1: DOWN,
    0.15: DOWN,
    0.25: plan(0, 1),
    0.4: DOWN,
    0.65: DOWN,
    1.0: plan(1, 2),
  },

  K: {
    0.1: DOWN,
    0.15: plan(0, 1),
    0.25: DOWN,
    0.4: DOWN,
    0.65: plan(1, 2),
    1.0: plan(2, 3),
  },

  L: {
    0.1: plan(0, 1),
    0.15: DOWN,
    0.25: DOWN,
    0.4: plan(1, 2),
    0.65: plan(2, 3),
    1.0: plan(3, 4),
  },

  M: {
    0.1: DOWN,
    0.15: DOWN,
    0.25: plan(1, 2),
    0.4: plan(2, 3),
    0.65: plan(3, 4),
    1.0: plan(5, 6),
  },

  N: {
    0.1: DOWN,
    0.15: plan(1, 2),
    0.25: plan(2, 3),
    0.4: plan(3, 4),
    0.65: plan(5, 6),
    1.0: plan(8, 9),
  },

  P: {
    0.1: plan(1, 2),
    0.15: plan(2, 3),
    0.25: plan(3, 4),
    0.4: plan(5, 6),
    0.65: plan(8, 9),
    1.0: plan(12, 13),
  },

  Q: {
    0.1: plan(2, 3),
    0.15: plan(3, 4),
    0.25: plan(5, 6),
    0.4: plan(8, 9),
    0.65: plan(12, 13),
    1.0: plan(18, 19),
  },

  R: {
    0.1: plan(3, 4),
    0.15: plan(5, 6),
    0.25: plan(8, 9),
    0.4: plan(12, 13),
    0.65: plan(18, 19),
    1.0: UP,
  },
};