// Preparación de vouchers antes de subirlos: imágenes a ~1600 px (WebP/JPEG), PDF tal cual.

export const MAX_VOUCHER_BYTES = 10 * 1024 * 1024;
const MAX_SIDE = 1600;

export interface PreparedVoucher {
  blob: Blob;
  extension: "webp" | "jpg" | "png" | "pdf";
  contentType: string;
  hash: string; // SHA-256 hex del archivo original (para detectar duplicados)
}

const sha256Hex = async (data: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

export const prepareVoucher = async (file: File): Promise<PreparedVoucher> => {
  const original = await file.arrayBuffer();
  const hash = await sha256Hex(original);

  if (file.type === "application/pdf") {
    if (file.size > MAX_VOUCHER_BYTES) throw new Error("El PDF pesa más de 10 MB");
    return { blob: file, extension: "pdf", contentType: "application/pdf", hash };
  }
  if (!file.type.startsWith("image/")) throw new Error("Sube una imagen o un PDF");

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const webp = await canvasToBlob(canvas, "image/webp", 0.82);
  if (webp && webp.type === "image/webp") {
    return { blob: webp, extension: "webp", contentType: "image/webp", hash };
  }
  const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.85);
  if (!jpeg) throw new Error("No se pudo comprimir la imagen");
  return { blob: jpeg, extension: "jpg", contentType: "image/jpeg", hash };
};
