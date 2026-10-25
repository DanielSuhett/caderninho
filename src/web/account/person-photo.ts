import { PersonPhotoSchema } from "../../contracts";

const formats = new Set(["image/jpeg", "image/png", "image/webp"]);
export async function preparePersonPhoto(file: File) {
  if (!formats.has(file.type)) {
    throw new Error("Use uma foto JPEG, PNG ou WebP.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Use uma foto de até 5 MB.");
  }
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 160;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Não foi possível preparar a foto neste navegador.");
    }
    context.fillStyle = "#fff";
    context.fillRect(0, 0, 160, 160);
    const edge = Math.min(image.width, image.height);
    context.drawImage(
      image,
      (image.width - edge) / 2,
      (image.height - edge) / 2,
      edge,
      edge,
      0,
      0,
      160,
      160,
    );
    return PersonPhotoSchema.parse(canvas.toDataURL("image/jpeg", 0.85));
  } finally {
    image.close();
  }
}
