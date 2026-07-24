import bcrypt from "bcryptjs";
import { userRepository } from "../repositories/UserRepository.js";

function createServiceError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeAccessLevel(role, accessLevel) {
  const level = Number(accessLevel);

  if ([1, 2, 3].includes(level)) {
    return level;
  }

  const normalizedRole = String(role || "")
    .trim()
    .toLowerCase();

  if (normalizedRole === "admin") {
    return 1;
  }

  if (
    ["lider", "líder", "supervisor", "analista"].includes(
      normalizedRole
    )
  ) {
    return 2;
  }

  return 3;
}

function roleFromAccessLevel(accessLevel) {
  const level = Number(accessLevel);

  if (level === 1) return "admin";
  if (level === 2) return "lider";

  return "inspetor";
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

function normalizeActive(value, fallback = true) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (value === false) {
    return false;
  }

  const normalized = String(value)
    .trim()
    .toLowerCase();

  if (
    ["false", "0", "no", "não"].includes(normalized)
  ) {
    return false;
  }

  return true;
}

function mapUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    matricula: user.matricula || "",
    cargo: user.cargo || "",
    role: user.role || "",

    accessLevel: normalizeAccessLevel(
      user.role,
      user.access_level
    ),

    inspectionArea: normalizeInspectionArea(
      user.inspection_area
    ),

    active: Boolean(user.active),

    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

export class UserService {
  async list() {
    const users = await userRepository.findAll();

    return users.map(mapUser);
  }

  async create(data = {}) {
    const {
      name,
      username,
      password,
      matricula,
      cargo,
      role,
      accessLevel,
      inspectionArea,
      inspection_area,
      active,
    } = data;

    if (!String(name || "").trim()) {
      throw createServiceError(
        "Informe o nome.",
        400
      );
    }

    if (!String(username || "").trim()) {
      throw createServiceError(
        "Informe o usuário.",
        400
      );
    }

    if (!String(password || "").trim()) {
      throw createServiceError(
        "Informe a senha.",
        400
      );
    }

    const requestedArea =
      inspectionArea !== undefined
        ? inspectionArea
        : inspection_area;

    const normalizedArea =
      normalizeInspectionArea(requestedArea);

    if (!normalizedArea) {
      throw createServiceError(
        "Selecione a área do usuário: IQC, OQC ou Ambos.",
        400
      );
    }

    const cleanUsername = String(username)
      .trim()
      .toLowerCase();

    const existing =
      await userRepository.findByUsername(
        cleanUsername
      );

    if (existing) {
      throw createServiceError(
        "Já existe um usuário com este login.",
        409
      );
    }

    const level = normalizeAccessLevel(
      role,
      accessLevel
    );

    const finalRole = roleFromAccessLevel(level);

    const passwordHash = await bcrypt.hash(
      String(password),
      10
    );

    const user = await userRepository.create({
      name: String(name).trim(),
      username: cleanUsername,
      passwordHash,
      matricula: String(matricula || "").trim(),
      cargo: String(cargo || "").trim(),
      role: finalRole,
      accessLevel: level,
      inspectionArea: normalizedArea,
      active: normalizeActive(active),
    });

    return mapUser(user);
  }

  async updateActive(id, active) {
    const activeValue = normalizeActive(active);

    const user =
      await userRepository.updateActive(
        id,
        activeValue
      );

    if (!user) {
      throw createServiceError(
        "Usuário não encontrado.",
        404
      );
    }

    return {
      user: mapUser(user),
      active: activeValue,
    };
  }

  async update(id, data = {}) {
    const {
      name,
      username,
      password,
      matricula,
      cargo,
      role,
      accessLevel,
      inspectionArea,
      inspection_area,
      active,
    } = data;

    if (!String(name || "").trim()) {
      throw createServiceError(
        "Informe o nome.",
        400
      );
    }

    if (!String(username || "").trim()) {
      throw createServiceError(
        "Informe o usuário.",
        400
      );
    }

    if (!String(matricula || "").trim()) {
      throw createServiceError(
        "Informe a matrícula.",
        400
      );
    }

    if (!String(cargo || "").trim()) {
      throw createServiceError(
        "Informe o cargo.",
        400
      );
    }

    const requestedArea =
      inspectionArea !== undefined
        ? inspectionArea
        : inspection_area;

    const normalizedArea =
      normalizeInspectionArea(requestedArea);

    if (!normalizedArea) {
      throw createServiceError(
        "Selecione a área do usuário: IQC, OQC ou Ambos.",
        400
      );
    }

    const cleanUsername = String(username)
      .trim()
      .toLowerCase();

    const existing =
      await userRepository.findByUsernameExcludingId(
        cleanUsername,
        id
      );

    if (existing) {
      throw createServiceError(
        "Já existe outro usuário com este login.",
        409
      );
    }

    const level = normalizeAccessLevel(
      role,
      accessLevel
    );

    const finalRole = roleFromAccessLevel(level);

    const activeValue = normalizeActive(active);

    let passwordHash = null;

    if (String(password || "").trim()) {
      passwordHash = await bcrypt.hash(
        String(password),
        10
      );
    }

    const user = await userRepository.update({
      id,

      name: String(name).trim(),
      username: cleanUsername,
      passwordHash,

      matricula: String(matricula).trim(),
      cargo: String(cargo).trim(),

      role: finalRole,
      accessLevel: level,

      inspectionArea: normalizedArea,
      active: activeValue,
    });

    if (!user) {
      throw createServiceError(
        "Usuário não encontrado.",
        404
      );
    }

    return mapUser(user);
  }
}

export const userService = new UserService();