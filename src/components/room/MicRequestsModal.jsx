import React from "react";

export default function MicRequestsModal({
  open,
  onClose,
  requests = [],
  onApprove,
  onReject,
  canModerate = false,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />

      <div
        className="absolute inset-0 flex items-end sm:items-center justify-center p-3"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md bg-white rounded-2xl shadow-xl border overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold text-[18px] text-slate-900">
              Mic Requests ({requests.length})
            </div>

            <button
              className="text-sm text-slate-600 hover:text-slate-900"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          <div className="max-h-[60vh] overflow-auto p-3 space-y-3">
            {requests.length === 0 ? (
              <div className="text-sm text-slate-500 p-3">
                No pending mic requests.
              </div>
            ) : (
              requests.map((req, index) => (
                <div
                  key={req.user_id || req.id || index}
                  className="w-full border rounded-xl p-3 bg-white flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {req.display_name || req.name || "User"}
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-1">
                      {req.user_id || req.id || ""}
                    </div>
                  </div>

                  {canModerate ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onApprove?.(req)}
                        className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 transition"
                      >
                        Approve
                      </button>

                      <button
                        onClick={() => onReject?.(req)}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 transition"
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}