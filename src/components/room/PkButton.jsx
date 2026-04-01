import React from "react";

export default function PkButton({
  onClick,
  disabled = false,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`shrink-0 h-8 px-2.5 rounded-lg text-xs font-bold transition ${
        disabled
          ? "bg-purple-300 text-white cursor-not-allowed"
          : "bg-purple-500 hover:bg-purple-600 text-white"
      }`}
      title="PK"
    >
      PK
    </button>
  );
}