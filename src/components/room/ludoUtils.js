// Utils and constants for LudoGame (extracted to avoid circular dependencies)

export const FALLBACK_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"128\" height=\"128\"><rect width=\"128\" height=\"128\" rx=\"64\" fill=\"#f1f5f9\"/><circle cx=\"64\" cy=\"52\" r=\"22\" fill=\"#cbd5e1\"/><path d=\"M24 112c8-22 28-34 40-34s32 12 40 34\" fill=\"#cbd5e1\"/></svg>`);

export const MAX_PLAYERS_OPTIONS = [2, 3, 4];
export const ENTRY_COST_OPTIONS = [0, 100, 200, 500, 1000, 5000, 10000];

export const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e'];
export const PLAYER_LIGHT_COLORS = ['#fca5a5', '#93c5fd', '#fcd34d', '#86efac'];
export const PLAYER_DARK_COLORS = ['#991b1b', '#1e40af', '#b45309', '#15803d'];

export const TRACK_CELLS = [
  [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],
  [8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],
  [13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0],
];

export const SAFE_SQUARES = [0, 8, 13, 21, 26, 34, 39, 47];
export const START_POSITIONS = [39, 26, 13, 0];
export const HOME_ENTRY_LOGICAL_INDEX = 50;

export const HOME_ENTRY_ARROW_CELLS = [
  [14, 7],
  [7, 14],
  [0, 7],
  [7, 0],
];

export const HOME_COLUMNS = [
  [[13,7],[12,7],[11,7],[10,7],[9,7]],
  [[7,13],[7,12],[7,11],[7,10],[7,9]],
  [[1,7],[2,7],[3,7],[4,7],[5,7]],
  [[7,1],[7,2],[7,3],[7,4],[7,5]],
];

export const HOME_BASES = [
  [[10.6,1.9],[10.6,4.1],[12.8,1.9],[12.8,4.1]],
  [[10.6,10.9],[10.6,13.1],[12.8,10.9],[12.8,13.1]],
  [[1.9,10.9],[1.9,13.1],[4.1,10.9],[4.1,13.1]],
  [[1.9,1.9],[1.9,4.1],[4.1,1.9],[4.1,4.1]],
];

export const PIECE_STACK_OFFSETS = [
  [0, 0],
  [-8, -8],
  [8, -8],
  [-8, 8],
  [8, 8],
];

export function getPieceStackOffset(index) {
  if (PIECE_STACK_OFFSETS[index]) return PIECE_STACK_OFFSETS[index];
  const overflowIndex = index - PIECE_STACK_OFFSETS.length;
  const angle = (overflowIndex / 6) * Math.PI * 2;
  const radius = 11 + Math.floor(overflowIndex / 6) * 4;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

export const VISUAL_SEAT_LAYOUTS = {
  2: [0, 2],
  3: [0, 1, 2],
  4: [0, 1, 2, 3],
};
