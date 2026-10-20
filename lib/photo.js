"use client";

/** Recorta a foto no centro em quadrado e reduz para JPEG leve (funciona com fotos do iPhone também). */
export function squareJpeg(file, size = 480) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const side = Math.min(im.naturalWidth, im.naturalHeight);
      const sx = (im.naturalWidth - side) / 2, sy = (im.naturalHeight - side) / 2;
      const c = document.createElement("canvas");
      c.width = c.height = size;
      c.getContext("2d").drawImage(im, sx, sy, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("falha ao converter"))), "image/jpeg", 0.86);
    };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Esse formato de imagem não abriu. Tente uma foto JPG ou PNG.")); };
    im.src = url;
  });
}
