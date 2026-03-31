import React from "react";

export default function PeopleInRoomButton({
  people = [],
  onClick,
}) {
  const topPeople = people.slice(0, 3); // أول 3 بس

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 bg-black/60 backdrop-blur px-2 py-1 rounded-full border border-white/10"
    >
      {/* Avatars */}
      <div className="flex -space-x-2">
        {topPeople.map((user, i) => (
          <img
            key={user.user_id || i}
            src={user.avatar || "/default-avatar.png"}
            alt=""
            className="w-6 h-6 rounded-full border-2 border-black object-cover"
          />
        ))}
      </div>

      {/* Count */}
      <span className="text-white text-xs font-semibold">
        {people.length}
      </span>
    </button>
  );
}