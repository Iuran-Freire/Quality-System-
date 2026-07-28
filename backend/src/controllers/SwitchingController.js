import { switchingService } from "../services/SwitchingService.js";

function sendError(
  res,
  error,
  fallbackMessage
) {
  const status =
    error.statusCode || 500;

  return res.status(status).json({
    ok: false,

    message:
      error.statusCode
        ? error.message
        : fallbackMessage,

    ...(!error.statusCode && {
      error: error.message,
    }),
  });
}

export class SwitchingController {
  async getPasswordStatus(req, res) {
    try {
      const result =
        await switchingService.getPasswordStatus();

      return res.json({
        ok: true,
        hasPassword:
          result.hasPassword,
      });
    } catch (error) {
      console.error(
        "Erro ao verificar senha de comutação:",
        error
      );

      return sendError(
        res,
        error,
        "Erro ao verificar senha de comutação."
      );
    }
  }

  async savePassword(req, res) {
    try {
      const result =
        await switchingService.savePassword(
          req.body || {}
        );

      return res.json({
        ok: true,
        message:
          "Senha de comutação salva com sucesso.",
        hasPassword:
          result.hasPassword,
      });
    } catch (error) {
      console.error(
        "Erro ao salvar senha de comutação:",
        error
      );

      return sendError(
        res,
        error,
        "Erro ao salvar senha de comutação."
      );
    }
  }

  async checkPassword(req, res) {
    try {
      await switchingService.checkPassword(
        req.body?.password
      );

      return res.json({
        ok: true,
        message:
          "Senha validada com sucesso.",
      });
    } catch (error) {
      console.error(
        "Erro ao validar senha de comutação:",
        error
      );

      return sendError(
        res,
        error,
        "Erro ao validar senha de comutação."
      );
    }
  }

  async analyzePlan(req, res) {
  try {
    const result =
      await switchingService.analyzePlan(
        req.params.planId
      );

    return res.json({
      ok: true,
      plan: result.plan,
      analysis: result.analysis,
    });
  } catch (error) {
    console.error(
      "Erro ao analisar comutação:",
      error
    );

    return sendError(
      res,
      error,
      "Erro ao analisar comutação."
    );
  }
}
}

export const switchingController =
  new SwitchingController();