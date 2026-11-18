import { apiUrl } from "../services/api";
import { USER_KEY } from "../services/tabSession";
const prefix = () => {
  try {
    return `vyumi_saved:${JSON.parse(sessionStorage.getItem(USER_KEY) || "null")?.id || "anonymous"}:`;
  } catch {
    return "vyumi_saved:anonymous:";
  }
};
export function safeProductUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
export function productLink(roomId, productId) {
  return `${window.location.origin}/room/${encodeURIComponent(roomId)}/product/${encodeURIComponent(productId)}`;
}
export function readSavedProducts(roomId) {
  try {
    return Object.keys(sessionStorage)
      .filter(
        (k) => k.startsWith(prefix()) && (!roomId || k === prefix() + roomId),
      )
      .flatMap((k) => {
        const list = JSON.parse(sessionStorage.getItem(k) || "[]");
        return Array.isArray(list) ? list.filter((p) => p?.id && p?.name) : [];
      })
      .slice(0, 100);
  } catch {
    return [];
  }
}
export function toggleSavedProduct(product, roomId = product.roomId) {
  if (!roomId || !sessionStorage.getItem(USER_KEY))
    throw new Error("Enter your name before saving.");
  const items = readSavedProducts(roomId),
    saved = items.some((p) => p.id === product.id);
  const next = saved
    ? items.filter((p) => p.id !== product.id)
    : [
        {
          id: product.id,
          name: product.name,
          price: product.price,
          category: product.category,
          imageUrl: apiUrl(product.imageUrl),
          sourceUrl: safeProductUrl(product.sourceUrl || product.product_url),
          roomId,
          link: productLink(roomId, product.id),
          savedAt: new Date().toISOString(),
        },
        ...items,
      ].slice(0, 100);
  sessionStorage.setItem(prefix() + roomId, JSON.stringify(next));
  window.dispatchEvent(new Event("vyumi:saved"));
  return !saved;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadProductImage(product) {
  if (!product.imageUrl) throw new Error("This product has no image.");
  const response = await fetch(apiUrl(product.imageUrl), {
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw new Error("Image unavailable.");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("Image unavailable.");
  downloadBlob(
    blob,
    `${product.name.replace(/[^a-z0-9]/gi, "-").slice(0, 60)}.${blob.type.split("/")[1] || "png"}`,
  );
}
