let authToken = "";

export function getAuthToken() {
  return authToken;
}

export function setAuthToken(token) {
  authToken = String(token || "");
}

export function clearAuthToken() {
  authToken = "";
}
