export function requireSetupKey(req, res, next) {
  const configuredKey = String(
    process.env.SETUP_KEY || ""
  ).trim();

  const receivedKey = String(
    req.headers["x-setup-key"] || ""
  ).trim();

  if (!configuredKey) {
    return res.status(503).json({
      ok: false,
      message:
        "Operações de configuração estão desabilitadas. Configure SETUP_KEY no servidor.",
    });
  }

  if (
    !receivedKey ||
    receivedKey !== configuredKey
  ) {
    return res.status(401).json({
      ok: false,
      message:
        "Chave de configuração inválida.",
    });
  }

  next();
}