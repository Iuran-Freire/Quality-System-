// src/utils/logo.js

/**
 * Lê um arquivo (via fetch) e retorna como DataURL (base64)
 * Funciona bem com assets importados pelo Vite.
 */
export async function fetchAsDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao carregar asset: ${url}`);
  const blob = await res.blob();

  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

import logoUrl from "../assets/Inventus_Power.png";

let cache = null;

/** Retorna DataURL da logo (com cache) */
export async function getLogoDataUrl() {
  if (cache) return cache;
  cache = await fetchAsDataUrl(logoUrl);
  return cache;
}