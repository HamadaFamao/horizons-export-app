import React from "react";

export default function LeaderboardModal({
  open,
  onClose,
  leaderboardTab,
  setLeaderboardTab,
  leaderboardData,
  fallbackAvatar,
  onOpenUserCard,
}) {
  if (!open) return null;

  const leaderboardRows = Array.isArray(leaderboardData)
    ? leaderboardData
    : leaderboardData?.[leaderboardTab] || [];

  const sortedData = [...leaderboardRows]
    .sort((a, b) => (b.coins || 0) - (a.coins || 0))
    .slice(0, 50);

  const topThree = sortedData.slice(0, 3);
  const standings = sortedData.slice(3, 50);

  const podiumOrder = [
    topThree[1] || null, // rank 2
    topThree[0] || null, // rank 1
    topThree[2] || null, // rank 3
  ];

  const handleUserClick = (user) => {
    if (!user || !onOpenUserCard) return;
    onOpenUserCard(user.user_id || user.id, user);
  };

  return (
    <>
      <style>{`
        @keyframes leaderboardBackdropFade {
          from { opacity: 0; backdrop-filter: blur(0px); }
          to { opacity: 1; backdrop-filter: blur(4px); }
        }

        @keyframes leaderboardCardPop {
          0% { opacity: 0; transform: translate(-50%, calc(-50% + 20px)) scale(0.95); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }

        @keyframes leaderboardCardPopMobile {
          0% { opacity: 0; transform: translate(-50%, calc(-50% + 30px)) scale(0.95); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }

        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes crownGlow {
          0%, 100% { filter: drop-shadow(0 0 5px rgba(250, 204, 21, 0.5)); transform: translateX(-50%) scale(1); }
          50% { filter: drop-shadow(0 0 15px rgba(250, 204, 21, 0.9)); transform: translateX(-50%) scale(1.1); }
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.5);
        }
      `}</style>

      <div
        onClick={onClose}
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
        style={{ animation: "leaderboardBackdropFade 0.3s ease-out forwards" }}
      />

      <div
        className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-24px)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[24px] bg-card border border-border/50 shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
        style={{
          animation:
            window.innerWidth < 640
              ? "leaderboardCardPopMobile 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards"
              : "leaderboardCardPop 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-between border-b border-border/50 p-5 pb-4 bg-gradient-to-r from-secondary/30 to-transparent">
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-bounce" style={{ animationDuration: "2s" }}>
              🏆
            </span>
            <h2 className="text-2xl font-black bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Leaderboard
            </h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors text-lg leading-none"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="flex px-5 pt-5">
          <div className="flex w-full rounded-xl bg-secondary/50 p-1.5 shadow-inner border border-border/50">
            {["weekly", "alltime"].map((tab) => (
              <button
                key={tab}
                onClick={() => setLeaderboardTab(tab)}
                className={`flex-1 rounded-lg py-2 text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                  leaderboardTab === tab
                    ? "bg-background text-primary shadow-md scale-[1.02] ring-1 ring-border/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                }`}
                type="button"
              >
                {tab === "weekly" ? (
                  <>
                    <span className="text-lg">🔥</span> Weekly
                  </>
                ) : (
                  <>
                    <span className="text-lg">🌟</span> All time
                  </>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-end justify-center gap-3 sm:gap-6 py-10 px-4 relative min-h-[260px] rounded-2xl bg-gradient-to-b from-secondary/20 to-secondary/5 border border-border/50 overflow-hidden shadow-inner">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
              <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl"></div>
              <div className="absolute top-20 -right-10 w-40 h-40 bg-yellow-400/10 rounded-full blur-3xl"></div>
            </div>

            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-0" />

            {podiumOrder.map((user, index) => {
              if (!user) return <div key={index} className="w-24 sm:w-28" />;

              const visualRank = index === 0 ? 2 : index === 1 ? 1 : 3;
              const isFirst = visualRank === 1;

              return (
                <button
                  key={user.user_id || user.id || index}
                  type="button"
                  onClick={() => handleUserClick(user)}
                  className={`relative z-10 flex flex-col items-center transition-transform hover:scale-105 cursor-pointer ${
                    isFirst ? "w-28 sm:w-32 -translate-y-4 sm:-translate-y-8" : "w-24 sm:w-28"
                  }`}
                  style={{
                    animation: `float ${isFirst ? "3s" : visualRank === 2 ? "3.5s" : "4s"} ease-in-out infinite`,
                  }}
                >
                  <div className="relative mb-3">
                    {isFirst ? (
                      <span
                        className="absolute -top-8 left-1/2 -translate-x-1/2 text-4xl z-20"
                        style={{ animation: "crownGlow 2s ease-in-out infinite" }}
                      >
                        👑
                      </span>
                    ) : visualRank === 2 ? (
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl z-20 drop-shadow-md">
                        🥈
                      </span>
                    ) : (
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl z-20 drop-shadow-md">
                        🥉
                      </span>
                    )}

                    <div className="relative">
                      <img
                        src={user.avatar || user.avatar_url || fallbackAvatar}
                        alt={user.name || "User"}
                        className={`relative z-10 rounded-full object-cover border-[4px] bg-background transition-all duration-300 ${
                          isFirst
                            ? "h-20 w-20 sm:h-24 sm:w-24 shadow-[0_0_25px_rgba(250,204,21,0.6)] border-yellow-400"
                            : "h-16 w-16 sm:h-20 sm:w-20 shadow-lg"
                        } ${
                          visualRank === 2
                            ? "border-slate-300 shadow-[0_0_15px_rgba(203,213,225,0.5)]"
                            : visualRank === 3
                            ? "border-amber-600 shadow-[0_0_15px_rgba(217,119,6,0.5)]"
                            : ""
                        }`}
                      />

                      <div
                        className={`absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-black border-2 border-background shadow-md z-20 ${
                          visualRank === 1
                            ? "bg-gradient-to-r from-yellow-300 to-yellow-500 text-yellow-950"
                            : visualRank === 2
                            ? "bg-gradient-to-r from-slate-200 to-slate-400 text-slate-900"
                            : "bg-gradient-to-r from-amber-500 to-amber-700 text-white"
                        }`}
                      >
                        #{visualRank}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 w-full text-center relative z-10 bg-background/60 backdrop-blur-sm rounded-lg py-1 px-2 shadow-sm border border-border/30">
                    <p className="truncate text-sm font-extrabold text-foreground drop-shadow-sm">
                      {user.name || "User"}
                    </p>
                    <div className="mt-0.5 flex items-center justify-center gap-1">
                      <span className="text-[10px] text-yellow-500">🪙</span>
                      <p className="truncate text-xs font-bold text-primary">
                        {(user.coins || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 max-h-[45vh] overflow-y-auto pr-2 space-y-2.5 custom-scrollbar pb-4">
            {standings.length > 0 ? (
              standings.map((user, idx) => (
                <button
                  key={user.user_id || user.id || idx}
                  type="button"
                  onClick={() => handleUserClick(user)}
                  className="w-full flex items-center justify-between rounded-xl border border-border/50 bg-secondary/30 p-3 transition-all hover:bg-secondary/80 hover:scale-[1.02] hover:shadow-md cursor-pointer text-left"
                  style={{
                    animation: `slideUpFade 0.4s ease-out forwards`,
                    animationDelay: `${idx * 0.05}s`,
                    opacity: 0,
                  }}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold shadow-inner ${
                        idx % 2 === 0
                          ? "bg-secondary/80 text-secondary-foreground"
                          : "bg-secondary/50 text-muted-foreground"
                      }`}
                    >
                      {idx + 4}
                    </div>

                    <div className="relative shrink-0">
                      <img
                        src={user.avatar || user.avatar_url || fallbackAvatar}
                        alt={user.name || "User"}
                        className="h-11 w-11 rounded-full border-2 border-border bg-background object-cover shadow-sm"
                      />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-foreground truncate">
                        {user.name || "User"}
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end shrink-0">
                    <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-md">
                      <span className="text-xs text-yellow-500">🪙</span>
                      <span className="font-bold text-primary text-sm">
                        {(user.coins || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div
                className="py-10 text-center text-muted-foreground flex flex-col items-center justify-center"
                style={{ animation: "slideUpFade 0.4s ease-out forwards" }}
              >
                <div className="mb-3 text-5xl opacity-50 grayscale">📭</div>
                <p className="text-lg font-medium">No rankings yet...</p>
                <p className="text-sm opacity-70">Be the first to climb the leaderboard!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}