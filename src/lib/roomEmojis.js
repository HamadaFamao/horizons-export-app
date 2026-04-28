const EMOJI_ANIMATION_PATTERN = [
  "emojiWiggle 0.6s ease-in-out infinite",
  "emojiBounce 0.8s ease-in-out infinite",
  "emojiShake 0.5s ease-in-out infinite",
  "emojiPulse 0.7s ease-in-out infinite",
  "emojiFloat 1s ease-in-out infinite",
  "emojiSpin 1.2s linear infinite",
];

function getEmojiAnimation(id) {
  if (id === "e3f") return "emojiShake 0.5s ease-in-out infinite";

  const numericId = Number(String(id).replace("e", ""));
  if (!Number.isFinite(numericId)) return "emojiBounce 0.8s ease-in-out infinite";

  if (numericId === 1) return "emojiWiggle 0.6s ease-in-out infinite";
  if (numericId === 2) return "emojiBounce 0.8s ease-in-out infinite";
  if (numericId === 3) return "emojiShake 0.5s ease-in-out infinite";
  if (numericId === 4) return "emojiPulse 0.7s ease-in-out infinite";
  if (numericId === 5) return "emojiFloat 1s ease-in-out infinite";

  const cycleIndex = (numericId - 6) % EMOJI_ANIMATION_PATTERN.length;
  return EMOJI_ANIMATION_PATTERN[cycleIndex];
}

const BASE_ROOM_EMOJIS = [
  { id: "e1",  src: "/emojis/lottie (1).json",  label: "reaction 1",  flip: false },
  { id: "e2",  src: "/emojis/lottie (2).json",  label: "reaction 2",  flip: false },
  { id: "e3",  src: "/emojis/lottie (3).json",  label: "reaction 3",  flip: false },
  { id: "e3f", src: "/emojis/lottie (3).json",  label: "reaction 3 flip", flip: true },
  { id: "e4",  src: "/emojis/lottie (4).json",  label: "reaction 4",  flip: false },
  { id: "e5",  src: "/emojis/lottie (5).json",  label: "reaction 5",  flip: false },
  { id: "e6",  src: "/emojis/lottie (6).json",  label: "reaction 6",  flip: false },
  { id: "e7",  src: "/emojis/lottie (7).json",  label: "reaction 7",  flip: false },
  { id: "e8",  src: "/emojis/lottie (8).json",  label: "reaction 8",  flip: false },
  { id: "e9",  src: "/emojis/lottie (9).json",  label: "reaction 9",  flip: false },
  { id: "e10", src: "/emojis/lottie (10).json", label: "reaction 10", flip: false },
  { id: "e11", src: "/emojis/lottie (11).json", label: "reaction 11", flip: false },
  { id: "e12", src: "/emojis/lottie (12).json", label: "reaction 12", flip: false },
  { id: "e13", src: "/emojis/lottie (13).json", label: "reaction 13", flip: false },
  { id: "e14", src: "/emojis/lottie (14).json", label: "reaction 14", flip: false },
  { id: "e15", src: "/emojis/lottie (15).json", label: "reaction 15", flip: false },
  { id: "e16", src: "/emojis/lottie (16).json", label: "reaction 16", flip: false },
  { id: "e17", src: "/emojis/lottie (17).json", label: "reaction 17", flip: false },
  { id: "e18", src: "/emojis/lottie (18).json", label: "reaction 18", flip: false },
  { id: "e19", src: "/emojis/lottie (19).json", label: "reaction 19", flip: false },
  { id: "e20", src: "/emojis/lottie (20).json", label: "reaction 20", flip: false },
  { id: "e21", src: "/emojis/lottie (21).json", label: "reaction 21", flip: false },
  { id: "e22", src: "/emojis/lottie (22).json", label: "reaction 22", flip: false },
  { id: "e23", src: "/emojis/lottie (23).json", label: "reaction 23", flip: false },
  { id: "e24", src: "/emojis/lottie (24).json", label: "reaction 24", flip: false },
  { id: "e25", src: "/emojis/lottie (25).json", label: "reaction 25", flip: false },
  { id: "e26", src: "/emojis/lottie (26).json", label: "reaction 26", flip: false },
  { id: "e27", src: "/emojis/lottie (27).json", label: "reaction 27", flip: false },
  { id: "e28", src: "/emojis/lottie (28).json", label: "reaction 28", flip: false },
  { id: "e29", src: "/emojis/lottie (29).json", label: "reaction 29", flip: false },
  { id: "e30", src: "/emojis/lottie (30).json", label: "reaction 30", flip: false },
  { id: "e31", src: "/emojis/lottie (31).json", label: "reaction 31", flip: false },
  { id: "e32", src: "/emojis/lottie (32).json", label: "reaction 32", flip: false },
  { id: "e33", src: "/emojis/lottie (33).json", label: "reaction 33", flip: false },
  { id: "e34", src: "/emojis/lottie (34).json", label: "reaction 34", flip: false },
  { id: "e35", src: "/emojis/lottie (35).json", label: "reaction 35", flip: false },
  { id: "e36", src: "/emojis/lottie (36).json", label: "reaction 36", flip: false },
  { id: "e37", src: "/emojis/lottie (37).json", label: "reaction 37", flip: false },
  { id: "e38", src: "/emojis/lottie (38).json", label: "reaction 38", flip: false },
  { id: "e39", src: "/emojis/lottie (39).json", label: "reaction 39", flip: false },
  { id: "e40", src: "/emojis/lottie (40).json", label: "reaction 40", flip: false },
  { id: "e41", src: "/emojis/lottie (41).json", label: "reaction 41", flip: false },
  { id: "e42", src: "/emojis/lottie (42).json", label: "reaction 42", flip: false },
  { id: "e43", src: "/emojis/lottie (43).json", label: "reaction 43", flip: false },
  { id: "e44", src: "/emojis/lottie (44).json", label: "reaction 44", flip: false },
  { id: "e45", src: "/emojis/lottie (45).json", label: "reaction 45", flip: false },
  { id: "e46", src: "/emojis/lottie (46).json", label: "reaction 46", flip: false },
  { id: "e47", src: "/emojis/lottie (47).json", label: "reaction 47", flip: false },
  { id: "e48", src: "/emojis/lottie (48).json", label: "reaction 48", flip: false },
  { id: "e49", src: "/emojis/lottie (49).json", label: "reaction 49", flip: false },
  { id: "e50", src: "/emojis/lottie (50).json", label: "reaction 50", flip: false },
  { id: "e51", src: "/emojis/lottie (51).json", label: "reaction 51", flip: false },
  { id: "e52", src: "/emojis/lottie (52).json", label: "reaction 52", flip: false },
  { id: "e53", src: "/emojis/lottie (53).json", label: "reaction 53", flip: false },
  { id: "e54", src: "/emojis/lottie (54).json", label: "reaction 54", flip: false },
];

export const ROOM_EMOJIS = BASE_ROOM_EMOJIS.map((emoji) => ({
  ...emoji,
  animation: getEmojiAnimation(emoji.id),
}));
