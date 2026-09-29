const AVATAR_COLORS = [
  "#F97316", // orange
  "#8B5CF6", // purple
  "#06B6D4", // cyan
  "#EC4899", // pink
  "#84CC16", // lime
  "#F59E0B", // amber
  "#3B82F6", // blue
  "#EF4444", // red
  "#14B8A6", // teal
  "#A855F7", // violet
];

export function getAvatarColor(userId) {
  const id = Number(userId) || 0;
  const index = id % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}