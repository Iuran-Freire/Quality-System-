import { getAuthToken } from "./authSession.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

export async function apiFetch(path, options = {}) {
  const token = getAuthToken();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Erro na comunicação com a API.");
  }

  return data;
}
