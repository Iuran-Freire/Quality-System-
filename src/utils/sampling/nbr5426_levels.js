// Tabela NBR 5426 / AQL - Letras código por tamanho de lote e nível de inspeção
// Níveis especiais: S1, S2, S3, S4
// Níveis gerais: I, II, III

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

// Mantém compatibilidade com o cálculo atual Normal.
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

const LEVEL_TABLE = [
  {
    min: 2,
    max: 8,
    S1: "A",
    S2: "A",
    S3: "A",
    S4: "A",
    I: "A",
    II: "A",
    III: "B",
  },
  {
    min: 9,
    max: 15,
    S1: "A",
    S2: "A",
    S3: "A",
    S4: "A",
    I: "A",
    II: "B",
    III: "C",
  },
  {
    min: 16,
    max: 25,
    S1: "A",
    S2: "A",
    S3: "B",
    S4: "B",
    I: "B",
    II: "C",
    III: "D",
  },
  {
    min: 26,
    max: 50,
    S1: "A",
    S2: "B",
    S3: "B",
    S4: "C",
    I: "C",
    II: "D",
    III: "E",
  },
  {
    min: 51,
    max: 90,
    S1: "B",
    S2: "B",
    S3: "C",
    S4: "C",
    I: "C",
    II: "E",
    III: "F",
  },
  {
    min: 91,
    max: 150,
    S1: "B",
    S2: "B",
    S3: "C",
    S4: "D",
    I: "D",
    II: "F",
    III: "G",
  },
  {
    min: 151,
    max: 280,
    S1: "B",
    S2: "C",
    S3: "D",
    S4: "E",
    I: "E",
    II: "G",
    III: "H",
  },
  {
    min: 281,
    max: 500,
    S1: "B",
    S2: "C",
    S3: "D",
    S4: "E",
    I: "F",
    II: "H",
    III: "J",
  },
  {
    min: 501,
    max: 1200,
    S1: "C",
    S2: "C",
    S3: "E",
    S4: "F",
    I: "G",
    II: "J",
    III: "K",
  },
  {
    min: 1201,
    max: 3200,
    S1: "C",
    S2: "D",
    S3: "E",
    S4: "G",
    I: "H",
    II: "K",
    III: "L",
  },
  {
    min: 3201,
    max: 10000,
    S1: "C",
    S2: "D",
    S3: "F",
    S4: "G",
    I: "J",
    II: "L",
    III: "M",
  },
  {
    min: 10001,
    max: 35000,
    S1: "C",
    S2: "D",
    S3: "F",
    S4: "H",
    I: "K",
    II: "M",
    III: "N",
  },
  {
    min: 35001,
    max: 150000,
    S1: "D",
    S2: "E",
    S3: "G",
    S4: "J",
    I: "L",
    II: "N",
    III: "P",
  },
  {
    min: 150001,
    max: 500000,
    S1: "D",
    S2: "E",
    S3: "G",
    S4: "J",
    I: "M",
    II: "P",
    III: "Q",
  },
  {
    min: 500001,
    max: Infinity,
    S1: "D",
    S2: "E",
    S3: "H",
    S4: "K",
    I: "N",
    II: "Q",
    III: "R",
  },
];

export function getCodeLetter(lotSize, level = "II") {
  const ls = Number(lotSize);

  if (!Number.isFinite(ls) || ls <= 0) {
    throw new Error("Lot size inválido");
  }

  const lvl = String(level || "II").toUpperCase();

  const validLevels = ["S1", "S2", "S3", "S4", "I", "II", "III"];

  if (!validLevels.includes(lvl)) {
    throw new Error(`Nível de inspeção inválido: ${lvl}`);
  }

  const row = LEVEL_TABLE.find((r) => ls >= r.min && ls <= r.max);

  if (!row) {
    throw new Error("Faixa de lote não encontrada");
  }

  const codeLetter = row[lvl];
  const sampleN = SAMPLE_SIZE_BY_CODE[codeLetter];

  if (!codeLetter || !sampleN) {
    throw new Error(`Código de amostragem não encontrado para nível ${lvl}`);
  }

  return {
    codeLetter,
    sampleN,
    level: lvl,
    lotSize: ls,
  };
}