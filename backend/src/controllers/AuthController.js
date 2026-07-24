import { authService } from "../services/AuthService.js";

export class AuthController {
  async login(req, res) {
    try {
      const result = await authService.login(
        req.body || {}
      );

      return res.json({
        ok: true,
        message: "Login realizado com sucesso.",
        token: result.token,
        user: result.user,
      });
    } catch (error) {
      console.error("Erro no login:", error);

      return res
        .status(error.statusCode || 500)
        .json({
          ok: false,

          message: error.statusCode
            ? error.message
            : "Erro no login.",

          ...(!error.statusCode && {
            error: error.message,
          }),
        });
    }
  }

  async seedAdmin(req, res) {
    try {
      const result =
        await authService.seedAdmin();

      return res.json({
        ok: true,
        message: result.message,

        ...(result.user && {
          user: result.user,
        }),
      });
    } catch (error) {
      console.error(
        "Erro ao criar admin:",
        error
      );

      return res.status(500).json({
        ok: false,
        message: "Erro ao criar admin.",
        error: error.message,
      });
    }
  }

  async seedInspector(req, res) {
    try {
      const result =
        await authService.seedInspector();

      return res.json({
        ok: true,
        message: result.message,

        ...(result.user && {
          user: result.user,
        }),
      });
    } catch (error) {
      console.error(
        "Erro ao criar inspetor:",
        error
      );

      return res.status(500).json({
        ok: false,
        message: "Erro ao criar inspetor.",
        error: error.message,
      });
    }
  }
}

export const authController =
  new AuthController();