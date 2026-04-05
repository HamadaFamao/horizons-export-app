import React, { useMemo, useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, X, Image as ImageIcon } from "lucide-react";

const ROOM_AVATAR_BUCKET = "room_avatars";

async function sha256Hex(str) {
  try {
    const enc = new TextEncoder();
    const buf = enc.encode(str);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    const arr = Array.from(new Uint8Array(hash));
    return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return btoa(unescape(encodeURIComponent(str)));
  }
}

function getExt(file) {
  const name = file?.name || "";
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "jpg";
}

export default function CreateRoomModal({ open, onClose, onCreated }) {
  const { user: authUser } = useAuth();

  const [title, setTitle] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [maxMics, setMaxMics] = useState(6);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview("");
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const canSubmit = useMemo(() => {
    if (!authUser?.id) return false;
    if (!title.trim()) return false;
    if (isLocked && pin.trim().length < 3) return false;
    const mm = Number(maxMics);
    if (!Number.isFinite(mm) || mm < 1 || mm > 12) return false;
    return true;
  }, [authUser?.id, title, isLocked, pin, maxMics]);

  const reset = () => {
    setTitle("");
    setAvatarFile(null);
    setAvatarPreview("");
    setIsLocked(false);
    setPin("");
    setMaxMics(6);
    setError("");
    setLoading(false);
  };

  const close = () => {
    if (loading) return;
    reset();
    onClose?.();
  };

  const uploadRoomAvatar = async (roomId, file) => {
    if (!file) return null;

    const ext = getExt(file);
    const path = `${roomId}/avatar.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(ROOM_AVATAR_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (upErr) throw upErr;

    const { data } = supabase.storage.from(ROOM_AVATAR_BUCKET).getPublicUrl(path);
    return data?.publicUrl || null;
  };

  const createRoom = async () => {
    try {
      setError("");
      if (!authUser?.id) throw new Error("Not authenticated");

      const t = title.trim();
      if (!t) throw new Error("Title is required");

      const mm = Number(maxMics) || 6;
      const pinHash = isLocked ? await sha256Hex(pin.trim()) : null;

      setLoading(true);

      // 1) create room first (without avatar)
      const { data: room, error: rErr } = await supabase
        .from("live_rooms")
        .insert({
          owner_user_id: authUser.id,
          title: t,
          avatar_url: null,
          is_locked: !!isLocked,
          pin_hash: isLocked ? pinHash : null,
          max_mics: mm,
          is_active: true,
        })
        .select("id, max_mics")
        .single();

      if (rErr) throw rErr;
      if (!room?.id) throw new Error("Room was not created");

      // 2) upload avatar if selected
      let avatarUrl = null;
      if (avatarFile) {
        avatarUrl = await uploadRoomAvatar(room.id, avatarFile);

        if (avatarUrl) {
          const { error: uErr } = await supabase
            .from("live_rooms")
            .update({ avatar_url: avatarUrl })
            .eq("id", room.id);

          if (uErr) console.warn("[CreateRoomModal] avatar update failed:", uErr.message);
        }
      }

      // 3) create mic seats 1..max_mics
      const seats = Array.from({ length: room.max_mics || mm }, (_, i) => ({
        room_id: room.id,
        seat_no: i + 1,
        user_id: null,
        locked: false,
      }));

      const { error: sErr } = await supabase.from("live_room_mic_seats").insert(seats);
      if (sErr && !String(sErr.message || "").toLowerCase().includes("duplicate")) {
        console.warn("[CreateRoomModal] seats insert error:", sErr.message);
      }

      onCreated?.(room.id);
      reset();
    } catch (e) {
      setError(e?.message || "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden="true" />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div>
              <div className="font-semibold text-lg">Create Room</div>
              <div className="text-xs text-gray-500">Set your room details</div>
            </div>

            <button
              onClick={close}
              className="p-2 rounded-lg hover:bg-gray-100"
              aria-label="Close"
              disabled={loading}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {error ? <div className="text-sm text-red-600 whitespace-pre-line">{error}</div> : null}

            <div className="space-y-2">
              <div className="text-sm font-medium">Title</div>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Room title…"
                disabled={loading}
              />
            </div>

            {/* ✅ Upload Avatar */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Room Avatar (Upload)</div>

              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full border bg-slate-50 overflow-hidden flex items-center justify-center">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-slate-500" />
                  )}
                </div>

                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    disabled={loading}
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setAvatarFile(f);
                    }}
                  />
                  <div className="text-xs text-slate-500 mt-1">
                    PNG/JPG recommended.
                  </div>
                </div>

                {avatarFile ? (
                  <Button
                    variant="outline"
                    disabled={loading}
                    onClick={() => setAvatarFile(null)}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isLocked}
                  onChange={(e) => setIsLocked(e.target.checked)}
                  disabled={loading}
                />
                Locked (PIN)
              </label>

              <div className="flex items-center gap-2">
                <div className="text-sm text-gray-600">Max mics</div>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={maxMics}
                  onChange={(e) => setMaxMics(e.target.value)}
                  disabled={loading}
                  className="w-24"
                />
              </div>
            </div>

            {isLocked ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">PIN (min 3 chars)</div>
                <Input
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter PIN…"
                  disabled={loading}
                />
                <div className="text-xs text-gray-500">
                  سيتم حفظ PIN كـ hash داخل قاعدة البيانات.
                </div>
              </div>
            ) : null}
          </div>

          <div className="px-5 py-4 border-t flex items-center justify-end gap-2">
            <Button variant="outline" onClick={close} disabled={loading}>
              Cancel
            </Button>

            <Button onClick={createRoom} disabled={loading || !canSubmit}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}