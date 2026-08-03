export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function safeText(value, fallback = "-") {
  const text = String(value || "").trim();
  return text || fallback;
}

export function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
