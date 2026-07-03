import type { EditorState, TimelineTextCue } from "@/lib/types";

export function getActiveTimelineCue(
  cues: TimelineTextCue[],
  currentTime: number,
) {
  return (
    cues
      .filter((cue) => currentTime >= cue.startTime && currentTime < cue.endTime)
      .sort((a, b) => b.startTime - a.startTime)[0] ?? null
  );
}

export function getTimelineTextState(state: EditorState, currentTime = 0) {
  if (state.mediaType !== "video") {
    return state;
  }

  const activeCue = getActiveTimelineCue(state.timelineTextCues, currentTime);

  if (!activeCue) {
    return state;
  }

  return {
    ...state,
    headline: activeCue.headline,
    subtitle: activeCue.subtitle,
  };
}

