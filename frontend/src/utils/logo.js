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

const logoUrl = "/quality-brand.svg";

let cache = null;

/** Retorna DataURL da logo (com cache) */
export async function getLogoDataUrl() {
  if (cache) return cache;
  const response = await fetch(logoUrl);
  if (!response.ok) throw new Error(`Falha ao carregar asset: ${logoUrl}`);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    cache = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 840;
        canvas.height = 240;
        const context = canvas.getContext("2d");
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      image.onerror = reject;
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  return cache;
}
