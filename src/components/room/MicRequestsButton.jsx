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
      <Mic className={`w-4 h-4 text-slate-700 ${count > 0 ? 'animate-bounce' : ''}`} />
      <span className={`text-sm ${count > 0 ? 'animate-pulse' : ''}`}>🙋‍♂️</span>

      {count > 0 ? (
        <>
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow animate-bounce">
            {count}
          </span>
          <span className="absolute inset-0 rounded-lg border-2 border-red-400 animate-ping opacity-75" />
        </>
      ) : null}
    </button>
  );
}