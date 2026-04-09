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
      className={`relative shrink-0 h-5 px-1.5 rounded flex items-center justify-center gap-1 transition-all duration-300 ${
        count > 0
          ? "bg-transparent border border-fuchsia-500 text-fuchsia-500 hover:border-fuchsia-400 hover:text-fuchsia-400 shadow-[0_0_8px_rgba(217,70,239,0.4)]"
          : "bg-transparent border border-slate-200 text-slate-700 hover:border-slate-300 shadow-sm"
      }`}
      title="Mic Requests"
    >
      <Mic className={`w-3 h-3 ${count > 0 ? 'text-fuchsia-500 animate-bounce' : 'text-slate-700'}`} />
      <span className={`text-[10px] ${count > 0 ? 'animate-pulse' : ''}`}>🙋‍♂️</span>

      {count > 0 ? (
        <>
          <span className="absolute -top-1 -right-1 min-w-[12px] h-[12px] px-0.5 rounded-full bg-gradient-to-tr from-red-500 to-orange-500 text-white text-[8px] font-bold flex items-center justify-center shadow-[0_0_5px_rgba(239,68,68,0.8)] ring-1 ring-white animate-bounce z-10">
            {count}
          </span>
          <span className="absolute inset-0 rounded border border-fuchsia-400 animate-ping opacity-75" />
        </>
      ) : null}
    </button>
  );
}