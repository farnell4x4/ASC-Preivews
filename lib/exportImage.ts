"use client";

import { computeCanvasLayout } from "@/lib/canvasLayout";
import type { CanvasPreset, EditorState } from "@/lib/types";

const FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export async function exportStateAsPng(preset: CanvasPreset, state: EditorState) {
  const canvas = document.createElement("canvas");
  canvas.width = preset.width;
  canvas.height = preset.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create export canvas.");
  }

  const layout = computeCanvasLayout(preset, state, 1);
  const screenshot = state.uploadedScreenshotUrl
    ? await loadImage(state.uploadedScreenshotUrl)
    : null;

  drawBackground(context, preset, state);
  drawText(context, state, layout);
  drawPhone(context, preset, state, layout, screenshot);

  const blob = await canvasToBlob(canvas);
  await verifyDimensions(blob, preset.width, preset.height);
  return blob;
}

function drawBackground(
  context: CanvasRenderingContext2D,
  preset: CanvasPreset,
  state: Pick<
    EditorState,
    | "backgroundColor"
    | "backgroundMode"
    | "backgroundAccentColor"
    | "backgroundAngle"
    | "backgroundFlip"
  >,
) {
  context.save();
  context.fillStyle = state.backgroundColor;
  context.fillRect(0, 0, preset.width, preset.height);

  if (state.backgroundMode === "solid") {
    context.restore();
    return;
  }

  let gradient: CanvasGradient;

  if (state.backgroundMode === "radial") {
    const radius = Math.max(preset.width, preset.height) * 0.75;
    gradient = context.createRadialGradient(
      preset.width / 2,
      preset.height / 2,
      0,
      preset.width / 2,
      preset.height / 2,
      radius,
    );
    const [center, edge] = state.backgroundFlip
      ? [state.backgroundAccentColor, state.backgroundColor]
      : [state.backgroundColor, state.backgroundAccentColor];
    gradient.addColorStop(0, center);
    gradient.addColorStop(1, edge);
  } else {
    const radians = ((state.backgroundAngle - 90) * Math.PI) / 180;
    const halfWidth = preset.width / 2;
    const halfHeight = preset.height / 2;
    const distance =
      Math.abs(halfWidth * Math.cos(radians)) + Math.abs(halfHeight * Math.sin(radians));
    const centerX = preset.width / 2;
    const centerY = preset.height / 2;
    const startX = centerX - Math.cos(radians) * distance;
    const startY = centerY - Math.sin(radians) * distance;
    const endX = centerX + Math.cos(radians) * distance;
    const endY = centerY + Math.sin(radians) * distance;
    gradient = context.createLinearGradient(startX, startY, endX, endY);

    if (state.backgroundMode === "linear") {
      const [start, end] = state.backgroundFlip
        ? [state.backgroundAccentColor, state.backgroundColor]
        : [state.backgroundColor, state.backgroundAccentColor];
      gradient.addColorStop(0, start);
      gradient.addColorStop(1, end);
    } else {
      const [edge, center] = state.backgroundFlip
        ? [state.backgroundAccentColor, state.backgroundColor]
        : [state.backgroundColor, state.backgroundAccentColor];
      gradient.addColorStop(0, edge);
      gradient.addColorStop(0.5, center);
      gradient.addColorStop(1, edge);
    }
  }

  context.fillStyle = gradient;
  context.fillRect(0, 0, preset.width, preset.height);
  context.restore();
}

function drawText(
  context: CanvasRenderingContext2D,
  state: EditorState,
  layout: ReturnType<typeof computeCanvasLayout>,
) {
  const textTop = layout.isTop ? layout.topPad : layout.canvasHeightPx - layout.bottomPad;
  const textY = textTop + layout.textBoxOffsetYPx;
  const titleLines = wrapText(
    context,
    state.headline,
    layout.textBoxWidthPx,
    `700 ${layout.titleSize}px ${FONT_FAMILY}`,
    -0.04 * layout.titleSize,
  );
  const subtitleLines = wrapText(
    context,
    state.subtitle,
    layout.textBoxWidthPx,
    `400 ${layout.subtitleSize}px ${FONT_FAMILY}`,
    0,
  );
  const titleLineHeight = layout.titleSize * 1.08;
  const subtitleLineHeight = layout.subtitleSize * 1.2;
  const titleBlockHeight = titleLines.length * titleLineHeight;
  const subtitleBlockTop = textY + titleBlockHeight + layout.gapSize;
  const subtitleBlockHeight = subtitleLines.length * subtitleLineHeight;
  const totalTextHeight = titleBlockHeight + layout.gapSize + subtitleBlockHeight;
  const startY = layout.isTop ? textY : textY - totalTextHeight;

  context.save();
  context.textBaseline = "top";
  context.fillStyle = state.textColor;

  context.font = `700 ${layout.titleSize}px ${FONT_FAMILY}`;
  drawTextLines(
    context,
    titleLines,
    layout.textBoxLeftPx,
    startY,
    titleLineHeight,
    -0.04 * layout.titleSize,
  );

  context.globalAlpha = 0.84;
  context.font = `400 ${layout.subtitleSize}px ${FONT_FAMILY}`;
  drawTextLines(
    context,
    subtitleLines,
    layout.textBoxLeftPx,
    startY + titleBlockHeight + layout.gapSize,
    subtitleLineHeight,
    0,
  );
  context.restore();
}

function drawPhone(
  context: CanvasRenderingContext2D,
  preset: CanvasPreset,
  state: EditorState,
  layout: ReturnType<typeof computeCanvasLayout>,
  screenshot: HTMLImageElement | null,
) {
  const isTablet = preset.device === "tablet";
  const bodyRadius = (isTablet ? 72 : 96) * state.phoneCornerScale;
  const screenRadius = (isTablet ? 54 : 78) * state.phoneCornerScale;
  const screenInset = layout.phoneWidthPx * (isTablet ? 0.022 : 0.027);
  const radians = (state.phoneRotation * Math.PI) / 180;

  context.save();
  context.translate(layout.phoneCenterXPx, layout.phoneCenterYPx);
  context.rotate(radians);
  context.translate(-layout.phoneWidthPx / 2, -layout.phoneHeightPx / 2);

  context.save();
  context.shadowColor = "rgba(15,23,42,0.18)";
  context.shadowBlur = 56;
  context.shadowOffsetY = 30;
  drawRoundedRect(context, 0, 0, layout.phoneWidthPx, layout.phoneHeightPx, bodyRadius);
  context.fillStyle = "#111827";
  context.fill();
  context.restore();

  drawPhoneButtons(context, layout.phoneWidthPx, layout.phoneHeightPx, isTablet);

  const screenX = screenInset;
  const screenY = screenInset;
  const screenWidth = layout.phoneWidthPx - screenInset * 2;
  const screenHeight = layout.phoneHeightPx - screenInset * 2;

  context.save();
  drawRoundedRect(context, screenX, screenY, screenWidth, screenHeight, screenRadius);
  context.clip();
  context.fillStyle = "#ffffff";
  context.fillRect(screenX, screenY, screenWidth, screenHeight);

  if (screenshot) {
    drawCoverImage(context, screenshot, screenX, screenY, screenWidth, screenHeight);
  } else {
    drawPlaceholderScreen(context, screenX, screenY, screenWidth, screenHeight);
  }

  if (!isTablet) {
    const islandWidth = screenWidth * 0.34;
    const islandHeight = screenHeight * 0.033;
    drawRoundedRect(
      context,
      screenX + screenWidth / 2 - islandWidth / 2,
      screenY + screenHeight * 0.018,
      islandWidth,
      islandHeight,
      islandHeight / 2,
    );
    context.fillStyle = "#000000";
    context.fill();
  }
  context.restore();

  context.save();
  drawRoundedRect(context, 0.5, 0.5, layout.phoneWidthPx - 1, layout.phoneHeightPx - 1, bodyRadius);
  context.strokeStyle = "rgba(255,255,255,0.14)";
  context.lineWidth = 1;
  context.stroke();
  context.restore();

  const highlight = context.createLinearGradient(0, 0, 0, layout.phoneHeightPx);
  highlight.addColorStop(0, "rgba(255,255,255,0.12)");
  highlight.addColorStop(0.4, "rgba(255,255,255,0.02)");
  highlight.addColorStop(1, "rgba(0,0,0,0.16)");
  context.save();
  drawRoundedRect(context, 0, 0, layout.phoneWidthPx, layout.phoneHeightPx, bodyRadius);
  context.clip();
  context.fillStyle = highlight;
  context.fillRect(0, 0, layout.phoneWidthPx, layout.phoneHeightPx);
  context.restore();

  context.restore();
}

function drawPhoneButtons(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  isTablet: boolean,
) {
  const buttonColor = "#0b1120";
  const buttonWidth = width * 0.0115;
  const radius = buttonWidth / 2;

  context.fillStyle = buttonColor;
  fillRoundedRect(context, width * 1.0005, height * 0.28, buttonWidth, height * (isTablet ? 0.09 : 0.1), radius);
  fillRoundedRect(context, -width * 0.0105, height * (isTablet ? 0.22 : 0.23), buttonWidth, height * (isTablet ? 0.075 : 0.085), radius);
  fillRoundedRect(context, -width * 0.0105, height * (isTablet ? 0.33 : 0.34), buttonWidth, height * (isTablet ? 0.075 : 0.085), radius);
}

function drawPlaceholderScreen(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const gradient = context.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, "#0f172a");
  gradient.addColorStop(0.48, "#1e3a8a");
  gradient.addColorStop(1, "#60a5fa");
  context.fillStyle = gradient;
  context.fillRect(x, y, width, height);
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const imageWidth =
    image instanceof HTMLImageElement ? image.naturalWidth || image.width : (image as ImageBitmap).width;
  const imageHeight =
    image instanceof HTMLImageElement ? image.naturalHeight || image.height : (image as ImageBitmap).height;
  const scale = Math.max(width / imageWidth, height / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const offsetX = x + (width - drawWidth) / 2;
  const offsetY = y + (height - drawHeight) / 2;
  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function fillRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  drawRoundedRect(context, x, y, width, height, radius);
  context.fill();
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string,
  letterSpacing: number,
) {
  context.save();
  context.font = font;

  const paragraphs = text.split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let currentLine = words[0];

    for (let index = 1; index < words.length; index += 1) {
      const candidate = `${currentLine} ${words[index]}`;
      if (measureTextWidth(context, candidate, letterSpacing) <= maxWidth) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = words[index];
      }
    }

    lines.push(currentLine);
  }

  context.restore();
  return lines;
}

function drawTextLines(
  context: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  startY: number,
  lineHeight: number,
  letterSpacing: number,
) {
  lines.forEach((line, index) => {
    drawTextWithLetterSpacing(context, line, x, startY + index * lineHeight, letterSpacing);
  });
}

function drawTextWithLetterSpacing(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  letterSpacing: number,
) {
  if (!text || letterSpacing === 0) {
    context.fillText(text, x, y);
    return;
  }

  let currentX = x;
  for (const character of Array.from(text)) {
    context.fillText(character, currentX, y);
    currentX += context.measureText(character).width + letterSpacing;
  }
}

function measureTextWidth(
  context: CanvasRenderingContext2D,
  text: string,
  letterSpacing: number,
) {
  if (!text || letterSpacing === 0) {
    return context.measureText(text).width;
  }

  const characters = Array.from(text);
  const textWidth = context.measureText(text).width;
  return textWidth + letterSpacing * Math.max(0, characters.length - 1);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load the screenshot for export."));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to render export image."));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
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
