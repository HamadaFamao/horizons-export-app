// XP thresholds per level (cumulative) - matches calculate_level_from_xp in DB
const LEVEL_THRESHOLDS = (() => {
  const thresholds = [0]; // level 1 starts at 0
  for (let l = 1; l <= 200; l++) {
    let xpNeeded;
    if (l <= 8)   xpNeeded = l * 5000;
    else if (l <= 12)  xpNeeded = 40000 + (l - 8) * 15000;
    else if (l <= 15)  xpNeeded = 100000 + (l - 12) * 25000;
    else if (l <= 20)  xpNeeded = 175000 + (l - 15) * 40000;
    else if (l <= 30)  xpNeeded = 375000 + (l - 20) * 60000;
    else if (l <= 40)  xpNeeded = 975000 + (l - 30) * 100000;
    else if (l <= 50)  xpNeeded = 2075000 + (l - 40) * 150000;
    else if (l <= 79)  xpNeeded = 3725000 + (l - 50) * 200000;
    else if (l <= 100) xpNeeded = 9525000 + (l - 79) * 300000;
    else if (l <= 150) xpNeeded = 15825000 + (l - 100) * 500000;
    else               xpNeeded = 40825000 + (l - 150) * 800000;
    thresholds.push(xpNeeded);
  }
  return thresholds;
})();

export function getLevelStats(totalXp) {
  if (!totalXp || typeof totalXp !== 'number' || totalXp < 0) totalXp = 0;

  let level = 1;
  for (let l = 1; l <= 200; l++) {
    if (totalXp >= LEVEL_THRESHOLDS[l]) {
      level = l + 1;
    } else {
      break;
    }
  }
  level = Math.min(level, 200);

  const xpStart = LEVEL_THRESHOLDS[level - 1] || 0;
  const xpEnd = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[199];
  const xpInLevel = totalXp - xpStart;
  const xpToNext = xpEnd - xpStart;
  const progress = xpToNext > 0 ? xpInLevel / xpToNext : 1;

  return {
    level,
    xpInLevel: Math.floor(xpInLevel),
    xpToNext: Math.floor(xpToNext),
    progress: Math.min(progress, 1),
    xpStart: Math.floor(xpStart),
  };
}

export function formatXp(xp) {
  return (xp || 0).toLocaleString();
}