import { inspectionService } from "../services/InspectionService.js";

function sendError(
  res,
  error,
  fallbackMessage
) {
  const status =
    error.statusCode || 500;

  const response = {
    ok: false,
    message: error.statusCode
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

export class InspectionController {
  async list(req, res) {
    try {
      const items =
        await inspectionService.list(
          req.user
        );

      return res.json({
        ok: true,
        items,
      });
    } catch (error) {
      console.error(
        "Erro ao listar inspeções:",
        error
      );

      return sendError(
        res,
        error,
        "Erro ao listar inspeções."
      );
    }
  }

  async getById(req, res) {
    try {
      const item =
        await inspectionService.getById(
          req.user,
          req.params.id
        );

      return res.json({
        ok: true,
        item,
      });
    } catch (error) {
      console.error(
        "Erro ao buscar inspeção:",
        error
      );

      return sendError(
        res,
        error,
        "Erro ao buscar inspeção."
      );
    }
  }
}

export const inspectionController =
  new InspectionController();