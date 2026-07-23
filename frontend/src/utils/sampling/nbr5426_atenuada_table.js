// NBR 5426 — Tabela 4
// Plano de amostragem simples — Atenuada
//
// Fonte: IGQ-002, página 6, Tabela 4.
// A condição Δ ocorre quando Re é maior que Ac + 1.

const DOWN = { arrow: "down" };
const UP = { arrow: "up" };

const plan = (ac, re, returnToNormalOnDelta = false) => ({
  ac,
  re,
  returnToNormalOnDelta,
});

export const AQL_TABLE_REDUCED = {
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
    1.0: plan(0, 1),
  },

  F: {
    0.1: DOWN,
    0.15: DOWN,
    0.25: DOWN,
    0.4: DOWN,
    0.65: plan(0, 1),
    1.0: UP,
  },

  G: {
    0.1: DOWN,
    0.15: DOWN,
    0.25: DOWN,
    0.4: plan(0, 1),
    0.65: UP,
    1.0: DOWN,
  },

  H: {
    0.1: DOWN,
    0.15: DOWN,
    0.25: plan(0, 1),
    0.4: UP,
    0.65: DOWN,
    1.0: plan(0, 2, true),
  },

  J: {
    0.1: DOWN,
    0.15: plan(0, 1),
    0.25: UP,
    0.4: DOWN,
    0.65: plan(0, 2, true),
    1.0: plan(1, 3, true),
  },

  K: {
    0.1: plan(0, 1),
    0.15: UP,
    0.25: DOWN,
    0.4: plan(0, 2, true),
    0.65: plan(1, 3, true),
    1.0: plan(1, 4, true),
  },

  L: {
    0.1: UP,
    0.15: DOWN,
    0.25: plan(0, 2, true),
    0.4: plan(1, 3, true),
    0.65: plan(1, 4, true),
    1.0: plan(2, 5, true),
  },

  M: {
    0.1: DOWN,
    0.15: plan(0, 2, true),
    0.25: plan(1, 3, true),
    0.4: plan(1, 4, true),
    0.65: plan(2, 5, true),
    1.0: plan(3, 6, true),
  },

  N: {
    0.1: plan(0, 2, true),
    0.15: plan(1, 3, true),
    0.25: plan(1, 4, true),
    0.4: plan(2, 5, true),
    0.65: plan(3, 6, true),
    1.0: plan(5, 8, true),
  },

  P: {
    0.1: plan(1, 3, true),
    0.15: plan(1, 4, true),
    0.25: plan(2, 5, true),
    0.4: plan(3, 6, true),
    0.65: plan(5, 8, true),
    1.0: plan(7, 10, true),
  },

  Q: {
    0.1: plan(1, 4, true),
    0.15: plan(2, 5, true),
    0.25: plan(3, 6, true),
    0.4: plan(5, 8, true),
    0.65: plan(7, 10, true),
    1.0: plan(10, 13, true),
  },

  R: {
    0.1: plan(2, 5, true),
    0.15: plan(3, 6, true),
    0.25: plan(5, 8, true),
    0.4: plan(7, 10, true),
    0.65: plan(10, 13, true),
    1.0: UP,
  },
};