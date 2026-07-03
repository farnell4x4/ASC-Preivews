import type { BackgroundMode, EditorState } from "@/lib/types";

type BackgroundFields = Pick<
  EditorState,
  | "backgroundColor"
  | "backgroundMode"
  | "backgroundAccentColor"
  | "backgroundAngle"
  | "backgroundFlip"
  | "backgroundSpread"
>;

export function getBackgroundStyle(state: BackgroundFields) {
  const primary = state.backgroundColor;
  const secondary = state.backgroundAccentColor;

  if (state.backgroundMode === "solid") {
    return {
      backgroundColor: primary,
      backgroundImage: "none",
    };
  }

  if (state.backgroundMode === "linear") {
    const [start, end] = state.backgroundFlip ? [secondary, primary] : [primary, secondary];
    return {
      backgroundColor: start,
      backgroundImage: `linear-gradient(${state.backgroundAngle}deg, ${start} ${state.backgroundSpread}%, ${end} 100%)`,
    };
  }

  if (state.backgroundMode === "advanced") {
    const [edge, center] = state.backgroundFlip ? [secondary, primary] : [primary, secondary];
    const shoulder = getAdvancedShoulder(state.backgroundSpread);
    const midpointBlend = mixHexColors(edge, center, 0.5);
    return {
      backgroundColor: edge,
      backgroundImage: `linear-gradient(${state.backgroundAngle}deg, ${edge} 0%, ${midpointBlend} ${shoulder}%, ${center} 50%, ${midpointBlend} ${100 - shoulder}%, ${edge} 100%)`,
    };
  }

  const [center, edge] = state.backgroundFlip ? [secondary, primary] : [primary, secondary];
  return {
    backgroundColor: edge,
    backgroundImage: `radial-gradient(circle at center, ${center} ${state.backgroundSpread}%, ${edge} 100%)`,
  };
}

export function getBackgroundModeLabel(mode: BackgroundMode) {
  switch (mode) {
    case "solid":
      return "Solid";
    case "linear":
      return "One-way";
    case "advanced":
      return "Advanced";
    case "radial":
      return "Circle";
  }
}

function getAdvancedShoulder(spread: number) {
  const normalized = (spread + 100) / 200;
  return 45 - normalized * 35;
}

function mixHexColors(start: string, end: string, amount: number) {
  const startRgb = parseHexColor(start);
  const endRgb = parseHexColor(end);

  if (!startRgb || !endRgb) {
    return start;
  }

  const mixChannel = (startChannel: number, endChannel: number) =>
    Math.round(startChannel + (endChannel - startChannel) * amount);

  return `rgb(${mixChannel(startRgb.r, endRgb.r)}, ${mixChannel(startRgb.g, endRgb.g)}, ${mixChannel(startRgb.b, endRgb.b)})`;
}

function parseHexColor(value: string) {
  const normalized = value.trim();
  const hex = normalized.startsWith("#") ? normalized.slice(1) : normalized;

  if (hex.length !== 6) {
    return null;
  }

  const parsed = Number.parseInt(hex, 16);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}
