import React from "react";
import { Bell } from "lucide-react";

export default function MicRequestsButton({
  count = 0,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative shrink-0 w-8 h-8 rounded-lg border bg-white hover:bg-slate-50 flex items-center justify-center transition"
      title="Mic Requests"
    >
      <Bell className="w-4 h-4 text-slate-700" />

      {count > 0 ? (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow">
          {count}
        </span>
      ) : null}
    </button>
  );
}