// Consistent color palette for charts
export const CHART_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f97316", // orange
  "#ec4899", // pink
  "#14b8a6", // teal
  "#6366f1", // indigo
];

export const PRESET_COLORS: Record<string, string> = {
  Fast: "#10b981",
  Medium: "#3b82f6",
  High: "#f59e0b",
};

export function getColorForIndex(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
