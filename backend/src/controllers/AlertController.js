import { alertService } from "../services/AlertService.js";

export class AlertController {
  async summary(req, res) {
    try {
      const summary =
        await alertService.getSummary(req.user);

      return res.json({
        ok: true,
        ...summary,
      });
    } catch (error) {
      console.error(
        "Erro ao consultar resumo de alertas:",
        error
      );

      return res.status(
        error.statusCode || 500
      ).json({
        ok: false,
        message:
          error.message ||
          "Erro ao consultar resumo de alertas.",
      });
    }
  }

  async list(req, res) {
    try {
      const items = await alertService.list(
        req.user,
        req.query.status
      );

      return res.json({
        ok: true,
        items,
      });
    } catch (error) {
      console.error(
        "Erro ao listar alertas:",
        error
      );

      return res.status(
        error.statusCode || 500
      ).json({
        ok: false,
        message:
          error.message ||
          "Erro ao listar alertas.",
      });
    }
  }

  async view(req, res) {
    try {
      const item =
        await alertService.markAsViewed(
          req.user,
          req.params.id
        );

      return res.json({
        ok: true,
        item,
      });
    } catch (error) {
      console.error(
        "Erro ao visualizar alerta:",
        error
      );

      return res.status(
        error.statusCode || 500
      ).json({
        ok: false,
        message:
          error.message ||
          "Erro ao atualizar alerta.",
      });
    }
  }

  async resolve(req, res) {
    try {
      const item = await alertService.resolve(
        req.user,
        req.params.id,
        req.body?.resolutionNote
      );

      return res.json({
        ok: true,
        message:
          "Alerta resolvido com sucesso.",
        item,
      });
    } catch (error) {
      console.error(
        "Erro ao resolver alerta:",
        error
      );

      return res.status(
        error.statusCode || 500
      ).json({
        ok: false,
        message:
          error.message ||
          "Erro ao resolver alerta.",
      });
    }
  }
}

export const alertController =
  new AlertController();