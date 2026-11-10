// スクショを送る前に、ブラウザの中で小さくする。
// iPhone のスクショは1枚 2〜3MB あり、6枚だとサーバーの受け取り上限（10MB）を超えて読み取れなかった。
// 文字が読める幅（1080px）にそろえて JPEG にすると、1枚 300KB 前後になる。

const MAX_WIDTH = 1080;
const QUALITY = 0.85;

export async function shrinkImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_WIDTH / bitmap.width);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    // 読めない形式（HEIC など）は、そのまま送る
    return file;
  }
}

export async function shrinkImages(files: File[]) {
  return Promise.all(files.map(shrinkImage));
}
