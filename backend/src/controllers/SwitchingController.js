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
async suggestPlan(req, res) {
  try {
    const result =
      await switchingService.suggestPlan(
        req.params.planId
      );

    return res.json({
      ok: true,

      message:
        "Sugestão de comutação registrada com sucesso.",

      plan:
        result.plan,

      analysis:
        result.analysis,
    });
  } catch (error) {
    console.error(
      "Erro ao registrar sugestão de comutação:",
      error
    );

    if (
      error.statusCode === 400 &&
      error.analysis
    ) {
      return res
        .status(400)
        .json({
          ok: false,
          message: error.message,
          analysis: error.analysis,
        });
    }

    return sendError(
      res,
      error,
      "Erro ao registrar sugestão de comutação."
    );
  }
}

async approvePlan(req, res) {
  try {
    const plan =
      await switchingService.approvePlan(
        req.user,
        req.params.planId,
        req.body || {}
      );

    return res.json({
      ok: true,

      message:
        "Comutação aprovada com sucesso.",

      plan,
    });
  } catch (error) {
    console.error(
      "Erro ao aprovar comutação:",
      error
    );

    return sendError(
      res,
      error,
      "Erro ao aprovar comutação."
    );
  }
}

async getHistory(req, res) {
  try {
    const items =
      await switchingService.getHistory();

    return res.json({
      ok: true,
      items,
    });
  } catch (error) {
    console.error(
      "Erro ao listar histórico de comutação:",
      error
    );

    return sendError(
      res,
      error,
      "Erro ao listar histórico de comutação."
    );
  }
}

}

export const switchingController =
  new SwitchingController();