export function isVisualAccepted({ ngCount, samplingSnapshot }) {
  // se não é NBR nem Cliente, continua “qualquer NG = FAIL”
  const mode = samplingSnapshot?.mode;

  if (mode !== "nbr5426" && mode !== "custom_client") {
    return ngCount === 0;
  }

  const ac = Number(samplingSnapshot?.ac);
  if (!Number.isFinite(ac)) {
    // fallback seguro: se não tem Ac, seja conservador
    return ngCount === 0;
  }

  // Regra 2: aceita se NG <= Ac
  return ngCount <= ac;
}