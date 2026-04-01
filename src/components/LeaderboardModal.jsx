import React from "react";

export default function LeaderboardModal({
  open,
  onClose,
  leaderboardTab,
  setLeaderboardTab,
  leaderboardData,
  fallbackAvatar,
}) {
  if (!open) return null;

  const leaderboardRows = Array.isArray(leaderboardData)
    ? leaderboardData
    : leaderboardData?.[leaderboardTab] || [];

  const sortedData = [...leaderboardRows].sort(
    (a, b) => (b.coins || 0) - (a.coins || 0)
  );

  const topThree = sortedData.slice(0, 3);
  const standings = sortedData.slice(3);

  const podiumOrder = [
    topThree[1] || null, // rank 2
    topThree[0] || null, // rank 1
    topThree[2] || null, // rank 3
  ];

  return (
    <>
      <style>{`
        @keyframes leaderboardBackdropFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes leaderboardCardPop {
          from {
            opacity: 0;
            transform: translate(-50%, calc(-50% + 18px)) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        @keyframes leaderboardCardPopMobile {
          from {
            opacity: 0;
            transform: translate(-50%, calc(-50% + 26px)) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
      `}</style>

      <div
        onClick={onClose}
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
        style={{ animation: "leaderboardBackdropFade 0.18s ease-out" }}
      />

      <div
        className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-24px)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-card border shadow-2xl"
        style={{
          animation:
            window.innerWidth < 640
              ? "leaderboardCardPopMobile 0.22s ease-out"
              : "leaderboardCardPop 0.22s ease-out",
        }}
      >
        <div className="relative flex items-center justify-between border-b p-4 pb-0">
          <h2 className="text-xl font-bold text-card-foreground">Leaderboard</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="flex px-4 pt-4">
          <div className="flex w-full rounded-lg bg-secondary p-1">
            {["weekly", "alltime"].map((tab) => (
              <button
                key={tab}
                onClick={() => setLeaderboardTab(tab)}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-all ${
                  leaderboardTab === tab
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "weekly" ? "Weekly" : "All time"}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-end justify-center gap-4 py-8 px-4 relative min-h-[220px] rounded-xl bg-secondary/20">
            <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent rounded-xl opacity-50 pointer-events-none" />

            {podiumOrder.map((user, index) => {
              if (!user) return <div key={index} className="w-24" />;

              const visualRank = index === 0 ? 2 : index === 1 ? 1 : 3;
              const isFirst = visualRank === 1;

              return (
                <div
                  key={user.user_id || index}
                  className={`relative z-10 flex flex-col items-center ${
                    isFirst ? "w-28 -translate-y-4" : "w-24"
                  }`}
                >
                  <div className="relative mb-2">
                    {isFirst ? (
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl drop-shadow-md">
                        👑
                      </span>
                    ) : visualRank === 2 ? (
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xl">
                        🥈
                      </span>
                    ) : (
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xl">
                        🥉
                      </span>
                    )}

                    <img
                      src={user.avatar || user.avatar_url || fallbackAvatar}
                      alt={user.name || "User"}
                      className={`rounded-full object-cover border-4 shadow-lg bg-background ${
                        isFirst ? "h-20 w-20" : "h-16 w-16"
                      } ${
                        visualRank === 1
                          ? "border-yellow-400"
                          : visualRank === 2
                          ? "border-slate-300"
                          : "border-amber-600"
                      }`}
                    />

                    <div
                      className={`absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-xs font-bold text-black border-2 border-background shadow-sm ${
                        visualRank === 1
                          ? "bg-yellow-400"
                          : visualRank === 2
                          ? "bg-slate-300"
                          : "bg-amber-600"
                      }`}
                    >
                      {visualRank}
                    </div>
                  </div>

                  <div className="mt-1 w-full text-center">
                    <p className="truncate text-sm font-bold text-card-foreground">
                      {user.name || "User"}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-primary">
                      {(user.coins || 0).toLocaleString()}{" "}
                      <span className="text-[10px] font-normal">Coins</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 max-h-[30vh] overflow-y-auto pr-1 space-y-2">
            {standings.length > 0 ? (
              standings.map((user, idx) => (
                <div
                  key={user.user_id || idx}
                  className="flex items-center justify-between rounded-lg border bg-secondary/50 p-3 transition-colors hover:bg-secondary/80"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 text-center font-bold text-muted-foreground">
                      {idx + 4}
                    </div>

                    <img
                      src={user.avatar || user.avatar_url || fallbackAvatar}
                      alt={user.name || "User"}
                      className="h-10 w-10 rounded-full border bg-background object-cover"
                    />

                    <div className="flex flex-col">
                      <span className="font-semibold text-card-foreground">
                        {user.name || "User"}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-bold text-primary">
                      {(user.coins || 0).toLocaleString()}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Coins
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-muted-foreground">
                <div className="mb-2 text-3xl opacity-40">✖</div>
                <p>No rankings yet...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}