"use client";

import { toBlob } from "html-to-image";

export async function exportNodeAsPng(node: HTMLElement, width: number, height: number) {
  const blob = await toBlob(node, {
    cacheBust: true,
    pixelRatio: 1,
    canvasWidth: width,
    canvasHeight: height,
    style: {
      margin: "0",
    },
  });

  if (!blob) {
    throw new Error("Failed to render export image.");
  }

  await verifyDimensions(blob, width, height);
  return blob;
}

async function verifyDimensions(blob: Blob, width: number, height: number) {
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await loadImage(objectUrl);
    if (image.naturalWidth !== width || image.naturalHeight !== height) {
      throw new Error(
        `Export mismatch. Expected ${width}x${height}, received ${image.naturalWidth}x${image.naturalHeight}.`,
      );
    }
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to verify the exported PNG."));
    image.src = src;
  });
}
