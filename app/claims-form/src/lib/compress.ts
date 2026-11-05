// Client-side image compression and base64 encoding for the photo upload.
import { LIMITS } from "../models/claim";

/** Long side 1600 px, JPEG 0.8, EXIF rotation applied. */
export async function compressImage(file: File): Promise<File> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, LIMITS.longSidePx / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < LIMITS.skipCompressionBelow) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available");
    ctx.fillStyle = "#fff"; // PNG transparency becomes white, JPEG has no alpha
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", LIMITS.jpegQuality));
    if (!blob) throw new Error(`Could not compress ${file.name}`);
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } finally {
    bmp.close();
  }
}

/** Encodes a blob as base64 without the data: prefix. */
export function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
