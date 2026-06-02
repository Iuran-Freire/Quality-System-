import { getCodeLetter } from "./nbr5426_levels";
import { AQL_TABLE, SAMPLE_SIZE_BY_CODE } from "./nbr5426_table";

function normalizeAql(aql) {
  const value = Number(String(aql ?? "").replace(",", "."));

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("AQL inválido");
  }

  return value;
}

function findPlan(code, aql) {
  const row = AQL_TABLE[code];

  if (!row) {
    throw new Error(`Código ${code} não encontrado na tabela AQL`);
  }

  const aqlValue = normalizeAql(aql);

  const keys = Object.keys(row)
    .map(Number)
    .sort((a, b) => a - b);

  const selectedAql = keys.find((k) => aqlValue <= k) ?? keys[keys.length - 1];

  let effectiveCodeLetter = code;
  let entry = AQL_TABLE[effectiveCodeLetter]?.[selectedAql];

  if (!entry) {
    throw new Error(
      `Plano não encontrado para código ${code} e AQL ${selectedAql}`
    );
  }

  // Resolve setas da Tabela 2.
  // Exemplo: J + AQL 0.4 => { use: "K" }
  let guard = 0;
  const switchPath = [code];

  while (entry?.use) {
    effectiveCodeLetter = entry.use;
    switchPath.push(effectiveCodeLetter);

    entry = AQL_TABLE[effectiveCodeLetter]?.[selectedAql];

    guard++;

    if (guard > 20) {
      throw new Error("Loop detectado ao resolver seta da NBR 5426");
    }

    if (!entry) {
      throw new Error(
        `Código indicado pela seta não encontrado: ${effectiveCodeLetter}, AQL ${selectedAql}`
      );
    }
  }

  const sampleN = SAMPLE_SIZE_BY_CODE[effectiveCodeLetter];

  if (!sampleN) {
    throw new Error(
      `Tamanho de amostra não encontrado para código ${effectiveCodeLetter}`
    );
  }

  if (entry.ac == null || entry.re == null) {
    throw new Error(
      `Ac/Re não encontrado para código ${effectiveCodeLetter} e AQL ${selectedAql}`
    );
  }

  return {
    initialCodeLetter: code,
    effectiveCodeLetter,
    selectedAql,
    sampleN,
    ac: entry.ac,
    re: entry.re,
    switched: code !== effectiveCodeLetter,
    switchPath,
  };
}

export function getSamplingPlan({
  lotSize,
  aql = 1.0,
  level,
  inspectionLevel,
} = {}) {
  const finalLevel = level || inspectionLevel || "II";

  const { codeLetter, sampleN: initialSampleN } = getCodeLetter(
    lotSize,
    finalLevel
  );

  const finalAql = normalizeAql(aql);
const plan = findPlan(codeLetter, finalAql);

return {
  mode: "nbr5426",
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

    switchPath: plan.switchPath,
    switched: plan.initialCodeLetter !== plan.effectiveCodeLetter,
    selectedAql: plan.selectedAql,
    
    source: "NBR_5426",
  };
}