import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { userRepository } from "../repositories/UserRepository.js";

function createServiceError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeInspectionArea(value) {
  const area = String(value || "")
    .trim()
    .toUpperCase();

  if (["IQC", "OQC", "ALL"].includes(area)) {
    return area;
  }

  return null;
}

function mapSafeUser(user) {
  const inspectionArea =
    normalizeInspectionArea(user.inspection_area);

  if (!inspectionArea) {
    throw createServiceError(
      "Usuário sem área de inspeção definida. Solicite a classificação como IQC, OQC ou Ambos.",
      403
    );
  }

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    matricula: user.matricula || "",
    cargo: user.cargo || "",
    role: user.role,
    accessLevel: Number(user.access_level || 3),
    inspectionArea,
    active: Boolean(user.active),
  };
}

export class AuthService {
  async login({ username, password } = {}) {
    const cleanUsername = String(username || "")
      .trim()
      .toLowerCase();

    const user =
      await userRepository.findAuthByUsername(
        cleanUsername
      );

    if (!user || !user.active) {
      throw createServiceError(
        "Usuário ou senha inválidos.",
        401
      );
    }

    const passwordOk = await bcrypt.compare(
      String(password || ""),
      user.password_hash
    );

    if (!passwordOk) {
      throw createServiceError(
        "Usuário ou senha inválidos.",
        401
      );
    }

    const safeUser = mapSafeUser(user);

    const token = jwt.sign(
      safeUser,
      process.env.JWT_SECRET,
      {
        expiresIn: "8h",
      }
    );

    return {
      token,
      user: safeUser,
    };
  }

  async seedAdmin() {
    const userData = {
      name: "Iuran",
      username: "iuran",
      password: "1234",
      matricula: "8919",
      cargo: "Admin",
      role: "admin",
      accessLevel: 1,
      inspectionArea: "ALL",
    };

    const existing =
      await userRepository.findByUsername(
        userData.username
      );

    if (existing) {
      return {
        created: false,
        message: "Usuário admin já existe.",
      };
    }

    const passwordHash = await bcrypt.hash(
      userData.password,
      10
    );

    await userRepository.create({
      name: userData.name,
      username: userData.username,
      passwordHash,
      matricula: userData.matricula,
      cargo: userData.cargo,
      role: userData.role,
      accessLevel: userData.accessLevel,
      inspectionArea: userData.inspectionArea,
      active: true,
    });

    return {
      created: true,
      message: "Usuário admin criado com sucesso.",

      user: {
        name: userData.name,
        username: userData.username,
        matricula: userData.matricula,
        cargo: userData.cargo,
        role: userData.role,
        accessLevel: userData.accessLevel,
        inspectionArea:
          userData.inspectionArea,
      },
    };
  }

  async seedInspector() {
    const userData = {
      name: "Inspetor Teste",
      username: "inspetor",
      password: "1234",
      matricula: "0003",
      cargo: "Inspetor IQC",
      role: "inspetor",
      accessLevel: 3,
      inspectionArea: "IQC",
    };

    const existing =
      await userRepository.findByUsername(
        userData.username
      );

    if (existing) {
      return {
        created: false,
        message: "Usuário inspetor já existe.",
      };
    }

    const passwordHash = await bcrypt.hash(
      userData.password,
      10
    );

    await userRepository.create({
      name: userData.name,
      username: userData.username,
      passwordHash,
      matricula: userData.matricula,
      cargo: userData.cargo,
      role: userData.role,
      accessLevel: userData.accessLevel,
      inspectionArea: userData.inspectionArea,
      active: true,
    });

    return {
      created: true,
      message:
        "Usuário inspetor criado com sucesso.",

      user: {
        name: userData.name,
        username: userData.username,
        matricula: userData.matricula,
        cargo: userData.cargo,
        role: userData.role,
        accessLevel: userData.accessLevel,
        inspectionArea:
          userData.inspectionArea,
      },
    };
  }
}

export const authService = new AuthService();