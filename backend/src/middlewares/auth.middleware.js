import jwt from "jsonwebtoken";

function normalizeInspectionArea(value) {
  const area = String(value || "")
    .trim()
    .toUpperCase();

  if (["IQC", "OQC", "ALL"].includes(area)) {
    return area;
  }

  return null;
}

export function requireAuth(req, res, next) {
  const authorization = String(
    req.headers.authorization || ""
  ).trim();

  if (!authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      ok: false,
      message:
        "Acesso não autorizado. Faça login novamente.",
    });
  }

  const token =
    authorization.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      ok: false,
      message:
        "Token de acesso não informado.",
    });
  }

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const inspectionArea =
      normalizeInspectionArea(
        payload?.inspectionArea
      );

    if (!inspectionArea) {
      return res.status(403).json({
        ok: false,
        message:
          "Usuário sem área de inspeção válida. Solicite classificação como IQC, OQC ou Ambos.",
      });
    }

    req.user = {
      ...payload,
      inspectionArea,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      message:
        "Sessão expirada ou inválida. Faça login novamente.",
    });
  }
}