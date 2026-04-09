import React from "react";
import { Mic } from "lucide-react";

export default function MicRequestsButton({
  count = 0,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative shrink-0 h-8 px-2 rounded-lg border bg-white hover:bg-slate-50 flex items-center justify-center gap-1 transition"
      title="Mic Requests"
    >
      <Mic className="w-4 h-4 text-slate-700" />
      <span className="text-sm">🙋‍♂️</span>

      {count > 0 ? (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow">
          {count}
        </span>
      ) : null}
    </button>
  );
}