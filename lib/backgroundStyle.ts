import type { BackgroundMode, EditorState } from "@/lib/types";

type BackgroundFields = Pick<
  EditorState,
  "backgroundColor" | "backgroundMode" | "backgroundAccentColor" | "backgroundAngle" | "backgroundFlip"
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
      backgroundImage: `linear-gradient(${state.backgroundAngle}deg, ${start} 0%, ${end} 100%)`,
    };
  }

  if (state.backgroundMode === "advanced") {
    const [edge, center] = state.backgroundFlip ? [secondary, primary] : [primary, secondary];
    return {
      backgroundColor: edge,
      backgroundImage: `linear-gradient(${state.backgroundAngle}deg, ${edge} 0%, ${center} 50%, ${edge} 100%)`,
    };
  }

  const [center, edge] = state.backgroundFlip ? [secondary, primary] : [primary, secondary];
  return {
    backgroundColor: edge,
    backgroundImage: `radial-gradient(circle at center, ${center} 0%, ${edge} 100%)`,
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
