import { planService } from "../services/PlanService.js";

function sendError(
  res,
  error,
  fallbackMessage
) {
  const status =
    error.statusCode || 500;

  const response = {
    ok: false,
    message:
      error.statusCode
        ? error.message
        : fallbackMessage,
  };

  if (!error.statusCode) {
    response.error = error.message;
  }

  return res
    .status(status)
    .json(response);
}

export class PlanController {
  async list(req, res) {
    try {
      const items =
        await planService.list(
          req.user
        );

      return res.json({
        ok: true,
        items,
      });
    } catch (error) {
      console.error(
        "Erro ao listar planos:",
        error
      );

      return sendError(
        res,
        error,
        "Erro ao listar planos."
      );
    }
  }

  async getById(req, res) {
    try {
      const item =
        await planService.getById(
          req.user,
          req.params.id
        );

      return res.json({
        ok: true,
        item,
      });
    } catch (error) {
      console.error(
        "Erro ao buscar plano:",
        error
      );

      return sendError(
        res,
        error,
        "Erro ao buscar plano."
      );
    }
  }

  async getRevisions(req, res) {
    try {
      const result =
        await planService.getRevisions(
          req.user,
          req.params.id
        );

      return res.json({
        ok: true,

        currentRevisionNumber:
          result.currentRevisionNumber,

        items:
          result.items,
      });
    } catch (error) {
      console.error(
        "Erro ao listar histórico de revisões:",
        error
      );

      return sendError(
        res,
        error,
        "Erro ao listar histórico de revisões."
      );
    }
  }

  async create(req, res) {
    try {
      const item =
        await planService.create(
          req.user,
          req.body || {}
        );

      return res
        .status(201)
        .json({
          ok: true,
          item,
        });
    } catch (error) {
      console.error(
        "Erro ao criar plano:",
        error
      );

      return sendError(
        res,
        error,
        "Erro ao criar plano."
      );
    }
  }

  async update(req, res) {
    try {
      const item =
        await planService.update(
          req.user,
          req.params.id,
          req.body || {}
        );

      return res.json({
        ok: true,
        item,
      });
    } catch (error) {
      console.error(
        "Erro ao atualizar plano:",
        error
      );

      return sendError(
        res,
        error,
        "Erro ao atualizar plano."
      );
    }
  }

  async delete(req, res) {
    try {
      await planService.delete(
        req.user,
        req.params.id
      );

      return res.json({
        ok: true,
        message:
          "Plano excluído com sucesso.",
      });
    } catch (error) {
      console.error(
        "Erro ao excluir plano:",
        error
      );

      return sendError(
        res,
        error,
        "Erro ao excluir plano."
      );
    }
  }
}

export const planController =
  new PlanController();