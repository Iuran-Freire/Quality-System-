import { userService } from "../services/UserService.js";

export class UserController {
  async list(req, res) {
    try {
      const users = await userService.list();

      return res.json({
        ok: true,
        users,
      });
    } catch (error) {
      console.error(
        "Erro ao listar usuários:",
        error
      );

      return res
        .status(error.statusCode || 500)
        .json({
          ok: false,
          message:
            error.message ||
            "Erro ao listar usuários.",
        });
    }
  }

  async create(req, res) {
    try {
      const user = await userService.create(
        req.body || {}
      );

      return res.status(201).json({
        ok: true,
        message: "Usuário criado com sucesso.",
        user,
      });
    } catch (error) {
      console.error(
        "Erro ao criar usuário:",
        error
      );

      return res
        .status(error.statusCode || 500)
        .json({
          ok: false,
          message:
            error.message ||
            "Erro ao criar usuário.",
        });
    }
  }

  async updateActive(req, res) {
    try {
      const result =
        await userService.updateActive(
          req.params.id,
          req.body?.active
        );

      return res.json({
        ok: true,

        message: result.active
          ? "Usuário ativado com sucesso."
          : "Usuário inativado com sucesso.",

        user: result.user,
      });
    } catch (error) {
      console.error(
        "Erro ao alterar status do usuário:",
        error
      );

      return res
        .status(error.statusCode || 500)
        .json({
          ok: false,
          message:
            error.message ||
            "Erro ao alterar status do usuário.",
        });
    }
  }

  async update(req, res) {
    try {
      const user = await userService.update(
        req.params.id,
        req.body || {}
      );

      return res.json({
        ok: true,
        message:
          "Usuário atualizado com sucesso.",
        user,
      });
    } catch (error) {
      console.error(
        "Erro ao editar usuário:",
        error
      );

      return res
        .status(error.statusCode || 500)
        .json({
          ok: false,
          message:
            error.message ||
            "Erro ao editar usuário.",
        });
    }
  }
}

export const userController =
  new UserController();