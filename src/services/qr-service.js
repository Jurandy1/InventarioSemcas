export async function generateQRCode(text) {
  const encoded = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encoded}`;
}

export function generateCoordinadorToken(unidadeId) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `coord_${unidadeId}_${timestamp}_${random}`;
}

export function generateCoordinadorLink(token, baseUrl = window.location.origin) {
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${baseUrl}${prefix}#/coord/${token}`;
}
