import bcrypt from "bcryptjs";
import { switchingRepository } from "../repositories/SwitchingRepository.js";

const SWITCHING_PASSWORD_KEY =
  "switching_password_hash";

function createServiceError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export class SwitchingService {
  async getPasswordStatus() {
    const passwordHash =
      await switchingRepository.getSetting(
        SWITCHING_PASSWORD_KEY
      );

    return {
      hasPassword: Boolean(passwordHash),
    };
  }

  async savePassword({
    password,
    confirmPassword,
  } = {}) {
    if (!String(password || "").trim()) {
      throw createServiceError(
        "Informe a senha de comutação.",
        400
      );
    }

    if (
      String(password) !==
      String(confirmPassword)
    ) {
      throw createServiceError(
        "A confirmação da senha não confere.",
        400
      );
    }

    if (String(password).length < 4) {
      throw createServiceError(
        "A senha de comutação deve ter pelo menos 4 caracteres.",
        400
      );
    }

    const passwordHash =
      await bcrypt.hash(
        String(password),
        10
      );

    await switchingRepository.saveSetting(
      SWITCHING_PASSWORD_KEY,
      passwordHash,
      "Senha criptografada para confirmação de comutação de regime de inspeção"
    );

    return {
      hasPassword: true,
    };
  }

  async checkPassword(password) {
    if (!String(password || "").trim()) {
      throw createServiceError(
        "Informe a senha de comutação.",
        400
      );
    }

    const passwordHash =
      await switchingRepository.getSetting(
        SWITCHING_PASSWORD_KEY
      );

    if (!passwordHash) {
      throw createServiceError(
        "Senha de comutação ainda não cadastrada.",
        400
      );
    }

    const valid = await bcrypt.compare(
      String(password),
      passwordHash
    );

    if (!valid) {
      throw createServiceError(
        "Senha de comutação inválida.",
        401
      );
    }

    return true;
  }
}

export const switchingService =
  new SwitchingService();