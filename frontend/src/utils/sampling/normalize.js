// src/utils/sampling/normalize.js
export function normalizePlanSampling(plan) {
  // planos antigos não tinham sampling
  if (!plan.sampling) {
    return {
      ...plan,
      sampling: {
        mode: "fixed",
      },
    };
  }

  // garante mode
  const mode = plan.sampling.mode || "fixed";

  // normaliza chaves para evitar undefined
  if (mode === "fixed") {
    return { ...plan, sampling: { mode: "fixed" } };
  }

  if (mode === "nbr5426") {
    return {
      ...plan,
      sampling: {
        mode: "nbr5426",
        level: plan.sampling.level || "II",
        aql: plan.sampling.aql ?? 1.0,
      },
    };
  }

  if (mode === "custom_client") {
    return {
      ...plan,
      sampling: {
        mode: "custom_client",
        sampleN: Number(plan.sampling.sampleN || plan.n || 0) || 0,
        ac: Number(plan.sampling.ac ?? 0),
        re: Number(plan.sampling.re ?? (Number(plan.sampling.ac ?? 0) + 1)),
      },
    };
  }

  // fallback
  return { ...plan, sampling: { mode: "fixed" } };
}