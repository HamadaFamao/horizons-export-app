import React from "react";
import { Bell } from "lucide-react";

function getRequesterName(req) {
  return (
    req?.requester_name ||
    req?.display_name ||
    req?.name ||
    req?.requester_display_name ||
    "User"
  );
}

function getRequesterSecondary(req) {
  return (
    req?.profile_id ||
    req?.vip_id ||
    req?.public_id ||
    req?.requester_profile_id ||
    ""
  );
}

function getRequesterAvatar(req) {
  return (
    req?.requester_avatar ||
    req?.avatar_url ||
    req?.avatar ||
    "/default-avatar.png"
  );
}

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
    <div className="fixed inset-0 z-[65]">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="absolute inset-0 flex items-end sm:items-center justify-center p-3"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md bg-white rounded-2xl shadow-xl border overflow-hidden flex flex-col max-h-[80vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
            <div className="font-semibold text-[18px] text-slate-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-slate-600" />
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
              <div className="text-sm text-slate-500 p-3 text-center">
                No pending requests.
              </div>
            ) : (
              requests.map((req, index) => (
                <div
                  key={req.id || req.user_id || index}
                  className="w-full border rounded-xl p-3 bg-white flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img
                      src={getRequesterAvatar(req)}
                      alt={getRequesterName(req)}
                      className="w-12 h-12 rounded-full object-cover bg-slate-100 shrink-0"
                      onError={(e) => {
                        e.currentTarget.src = "/default-avatar.png";
                      }}
                    />

                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {getRequesterName(req)}
                      </div>

                      {getRequesterSecondary(req) ? (
                        <div className="text-xs text-slate-500 truncate mt-1">
                          {getRequesterSecondary(req)}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {canModerate ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onApprove?.(req.id)}
                        className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 transition"
                      >
                        Approve
                      </button>

                      <button
                        onClick={() => onReject?.(req.id)}
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