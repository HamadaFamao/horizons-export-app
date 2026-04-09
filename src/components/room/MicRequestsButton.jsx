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
      className={`relative shrink-0 h-8 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all duration-300 ${
        count > 0
          ? "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 hover:from-violet-400 hover:via-fuchsia-400 hover:to-pink-400 text-white shadow-[0_0_15px_rgba(217,70,239,0.6)] border border-transparent"
          : "bg-gradient-to-b from-white to-slate-100 hover:from-white hover:to-white text-slate-700 border border-slate-200 shadow-sm"
      }`}
      title="Mic Requests"
    >
      <Mic className={`w-4 h-4 ${count > 0 ? 'text-white animate-bounce' : 'text-slate-700'}`} />
      <span className={`text-sm ${count > 0 ? 'animate-pulse' : ''}`}>🙋‍♂️</span>

      {count > 0 ? (
        <>
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 rounded-full bg-gradient-to-tr from-red-500 to-orange-500 text-white text-[10px] font-bold flex items-center justify-center shadow-[0_0_10px_rgba(239,68,68,0.8)] ring-1 ring-white animate-bounce z-10">
            {count}
          </span>
          <span className="absolute inset-0 rounded-lg border-2 border-fuchsia-400 animate-ping opacity-75" />
        </>
      ) : null}
    </button>
  );
}