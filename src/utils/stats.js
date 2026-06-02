export function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function stdSample(arr) {
  if (arr.length < 2) return NaN;
  const m = mean(arr);
  const v = arr.reduce((acc, x) => acc + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
}

export function Cp(lsl, usl, s) {
  if (!isFinite(s) || s === 0) return NaN;
  return (usl - lsl) / (6 * s);
}

export function Cpk(m, lsl, usl, s) {
  if (!isFinite(s) || s === 0) return NaN;
  return Math.min((usl - m) / (3 * s), (m - lsl) / (3 * s));
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
