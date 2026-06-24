import { getCodeLetter } from "./nbr5426_levels";
import {
  getAqlTableByRegime,
  getSampleSizeByRegime,
  NBR_REGIME_TABLES_READY,
} from "./nbr5426_table";

function normalizeAql(aql) {
  const value = Number(String(aql ?? "").replace(",", "."));

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("AQL inválido");
  }

  return value;
}

function findPlan(code, aql, regime = "normal") {
  const aqlTable = getAqlTableByRegime(regime);
  const sampleSizeTable = getSampleSizeByRegime(regime);

  const aqlValue = normalizeAql(aql);

  const codeOrder = [
    "A", "B", "C", "D", "E", "F", "G", "H",
    "J", "K", "L", "M", "N", "P", "Q", "R", "S",
  ];

  const currentIndex = codeOrder.indexOf(code);

  if (currentIndex === -1) {
    throw new Error(`Código de amostragem inválido: ${code}`);
  }

  const availableCodes = codeOrder.filter((letter) => {
    const row = aqlTable[letter];

    if (!row) return false;

    return row[aqlValue]?.ac != null && row[aqlValue]?.re != null;
  });

  if (!availableCodes.length) {
    throw new Error(
      `Não existe plano disponível para AQL ${aqlValue} no regime ${regime}`
    );
  }

  let effectiveCodeLetter = code;
  let entry = aqlTable[effectiveCodeLetter]?.[aqlValue];

  if (!entry || entry.arrow) {
    const requestedIndex = codeOrder.indexOf(code);

    const codesBelow = availableCodes.filter(
      (letter) => codeOrder.indexOf(letter) > requestedIndex
    );

    const codesAbove = availableCodes.filter(
      (letter) => codeOrder.indexOf(letter) < requestedIndex
    );

    const firstBelow = codesBelow[0] || null;
    const firstAbove = codesAbove[codesAbove.length - 1] || null;

    if (entry?.arrow === "up") {
      effectiveCodeLetter = firstAbove;
    } else if (entry?.arrow === "down") {
      effectiveCodeLetter = firstBelow;
    } else {
      effectiveCodeLetter = firstBelow || firstAbove;
    }

    if (!effectiveCodeLetter) {
      throw new Error(
        `Não foi possível resolver a seta para código ${code}, AQL ${aqlValue}`
      );
    }

    entry = aqlTable[effectiveCodeLetter]?.[aqlValue];
  }

  if (!entry || entry.ac == null || entry.re == null) {
    throw new Error(
      `Plano não encontrado para código ${code}, AQL ${aqlValue} e regime ${regime}`
    );
  }

  const sampleN = sampleSizeTable[effectiveCodeLetter];

  if (!sampleN) {
    throw new Error(
      `Tamanho de amostra não encontrado para código ${effectiveCodeLetter}`
    );
  }

  return {
    initialCodeLetter: code,
    effectiveCodeLetter,
    selectedAql: aqlValue,
    sampleN,
    ac: entry.ac,
    re: entry.re,
    returnToNormalOnDelta: Boolean(entry.returnToNormalOnDelta),
    switched: code !== effectiveCodeLetter,
    switchPath: [code, effectiveCodeLetter],
  };
}

export function getSamplingPlan({
  lotSize,
  aql = 1.0,
  level,
  inspectionLevel,
  regime = "normal",
} = {}) {
  if (
  regime !== "normal" &&
  !NBR_REGIME_TABLES_READY
) {
  throw new Error(
    "Tabela NBR 5426 para inspeção Atenuada/Severa ainda está em validação."
  );
}
  const finalLevel = level || inspectionLevel || "II";

  const { codeLetter } = getCodeLetter(lotSize, finalLevel);

  const sampleSizeTable = getSampleSizeByRegime(regime);

  const initialSampleN = sampleSizeTable[codeLetter];

  const finalAql = normalizeAql(aql);
const plan = findPlan(codeLetter, finalAql, regime);

return {
  mode: "nbr5426",
  inspectionRegime: regime,
  lotSize: Number(lotSize),
  level: finalLevel,
  inspectionLevel: finalLevel,
  aql: finalAql,

    // Código da Tabela 1
    codeLetter,
    initialCodeLetter: plan.initialCodeLetter,
    initialSampleN,

    // Código realmente usado após seta
    effectiveCodeLetter: plan.effectiveCodeLetter,
    sampleN: plan.sampleN,

    ac: plan.ac,
    re: plan.re,
    accept: plan.ac,
    reject: plan.re,
    returnToNormalOnDelta: plan.returnToNormalOnDelta,

    switchPath: plan.switchPath,
    switched: plan.initialCodeLetter !== plan.effectiveCodeLetter,
    selectedAql: plan.selectedAql,
    
    source: "NBR_5426",
  };
}