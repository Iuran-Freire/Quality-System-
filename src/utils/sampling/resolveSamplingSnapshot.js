import { getSamplingPlan } from "./nbr5426";
import { normalizePlanSampling } from "./normalize";

export function resolveSamplingSnapshot({ plan, lotSize }) {
  const p = normalizePlanSampling(plan);

  // fixed
  if (p.sampling.mode === "fixed") {
    const n = Number(p.n || 0);
    if (!n || n <= 0) throw new Error("Plano sem n válido (amostragem fixa).");

    return {
      mode: "fixed",
      sampleN: n,
      // Ac/Re não se aplicam aqui (mantém null)
      ac: null,
      re: null,
      lotSize: Number(lotSize || 0) || null,
      level: null,
      aql: null,
      codeLetter: null,
    };
  }

  // nbr5426
  if (p.sampling.mode === "nbr5426") {
    const ls = Number(lotSize);
    if (!Number.isFinite(ls) || ls <= 1) {
      throw new Error("Lot Size obrigatório e deve ser > 1 para NBR 5426.");
    }

    const { codeLetter, sampleN, ac, re } = getSamplingPlan({
      lotSize: ls,
      aql: p.sampling.aql,
      level: p.sampling.level || "II",
    });

    return {
      mode: "nbr5426",
      lotSize: ls,
      level: String(p.sampling.level || "II").toUpperCase(),
      aql: Number(p.sampling.aql),
      codeLetter,
      sampleN,
      ac,
      re,
    };
  }

  // custom_client
  if (p.sampling.mode === "custom_client") {
    const sampleN = Number(p.sampling.sampleN);
    if (!Number.isFinite(sampleN) || sampleN <= 0) {
      throw new Error("Cliente: sampleN inválido.");
    }

    const ac = Number(p.sampling.ac);
    const re = Number(p.sampling.re);

    return {
      mode: "custom_client",
      lotSize: Number(lotSize || 0) || null,
      level: null,
      aql: null,
      codeLetter: null,
      sampleN,
      ac,
      re,
    };
  }

  // fallback
  throw new Error("Modo de amostragem inválido.");
}