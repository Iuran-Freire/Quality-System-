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

  async create(req, res) {
  try {
    const item =
      await inspectionService.create(
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
      "Erro ao criar inspeção:",
      error
    );

    if (
      error.statusCode === 409 &&
      error.switching
    ) {
      return res
        .status(409)
        .json({
          ok: false,
          message: error.message,
          switching: error.switching,
        });
    }

    return sendError(
      res,
      error,
      "Erro ao criar inspeção."
    );
  }
}

 async update(req, res) {
  try {
    const item =
      await inspectionService.update(
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
      "Erro ao atualizar inspeção:",
      error
    );

    return sendError(
      res,
      error,
      "Erro ao atualizar inspeção."
    );
  }
 }

 async approveConditionally(req, res) {
  try {
    const item =
      await inspectionService.approveConditionally(
        req.user,
        req.params.id,
        req.body || {}
      );

    return res.json({
      ok: true,
      message:
        "Lote aprovado condicionalmente. O resultado oficial permanece FAIL.",
      item,
    });
  } catch (error) {
    console.error(
      "Erro ao registrar aprovação condicional:",
      error
    );

    return sendError(
      res,
      error,
      "Erro ao registrar aprovação condicional."
    );
  }
}

async delete(user, id) {
  const userArea =
    getLoggedUserArea(user);

  if (!userArea) {
    throw createServiceError(
      "Seu usuário não possui uma área de inspeção válida. Verifique o cadastro do usuário.",
      403
    );
  }

  const inspection =
    await inspectionRepository.findById(id);

  if (!inspection) {
    throw createServiceError(
      "Inspeção não encontrada.",
      404
    );
  }

  if (
    !userCanAccessArea(
      user,
      inspection.type
    )
  ) {
    throw createServiceError(
      "Você não possui autorização para excluir inspeções desta área.",
      403
    );
  }

  const deleted =
    await inspectionRepository.deleteById(id);

  if (!deleted) {
    throw createServiceError(
      "Inspeção não encontrada.",
      404
    );
  }

  return deleted;
}
}

export const inspectionController =
  new InspectionController();