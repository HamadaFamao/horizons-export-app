import React from "react";

export default function PeopleInRoomButton({
  people = [],
  onClick,
}) {
  const topPeople = Array.isArray(people) ? people.slice(0, 3) : [];
  const totalCount = Array.isArray(people) ? people.length : 0;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-full bg-black/70 backdrop-blur px-2 py-1.5 shadow-md hover:bg-black/80 transition"
      title="People in room"
      type="button"
    >
      <div className="flex items-center -space-x-2">
        {topPeople.length > 0 ? (
          topPeople.map((user, index) => (
            <div
              key={user.user_id || index}
              className={`relative ${
                index === 0 ? "z-30" : index === 1 ? "z-20" : "z-10"
              }`}
            >
              <div className="h-8 w-8 rounded-full ring-2 ring-black overflow-hidden bg-slate-200">
                <img
                  src={user.avatar || "/default-avatar.png"}
                  alt={user.name || "User"}
                  className="h-full w-full object-cover"
                />
              </div>

              {index === 0 ? (
                <span className="absolute -top-1.5 -right-1.5 z-40 text-[11px] leading-none -rotate-12 drop-shadow-[0_0_5px_rgba(255,215,0,0.8)] animate-pulse">
                  👑
                </span>
              ) : null}
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/15 text-white text-xs">
            0
          </div>
        )}
      </div>

      <div className="min-w-[18px] text-white text-sm font-semibold leading-none">
        {totalCount}
      </div>
    </button>
  );
}