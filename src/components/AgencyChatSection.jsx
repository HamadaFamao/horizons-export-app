import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2, Mic, Square, Smile, Paperclip } from "lucide-react";

function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

const DEFAULT_AVATAR = "/placeholder-avatar.png";

const EMOJI_LIST = [
  "😀","😁","😂","🤣","😊","😍","😘","😎","🥳","😢","😡","👍","👎","👏","🙏",
  "❤️","💔","🔥","💎","🎉","✨","🌹","💯","✅","❌","⚡","🎁","📌","🎤","📷",
  "😴","🤝","🤍","🖤","💙","💚","💛","💜","🧡","🌟","🎯","🥰","🤩","😇"
];

function isAudioUrl(url) {
  if (!url) return false;
  return /\.(webm|ogg|mp3|wav|m4a|aac)(\?|$)/i.test(url);
}

function guessType(file) {
  const t = (file?.type || "").toLowerCase();
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("audio/")) return "audio"; // هنحاول audio أولاً
  return "file";
}

// يحاول insert ويعمل fallback لنوع تاني لو constraint رفض
async function insertMessageWithTypeFallback(row, preferredType, fallbackType) {
  const { error: e1 } = await supabase.from("agency_messages").insert({
    ...row,
    content_type: preferredType,
  });
  if (!e1) return { ok: true };

  // لو error من نوع check constraint، نجرب fallback
  const msg = (e1.message || "").toLowerCase();
  const isCheck =
    msg.includes("violates check constraint") ||
    msg.includes("message_type_check") ||
    msg.includes("agency_messages_message_type_check");

  if (isCheck && fallbackType) {
    const { error: e2 } = await supabase.from("agency_messages").insert({
      ...row,
      content_type: fallbackType,
    });
    if (!e2) return { ok: true };
    return { ok: false, error: e2 };
  }

  return { ok: false, error: e1 };
}

export default function AgencyChatSection({ embedded = true, profile: profileProp = null }) {
  const { user: authUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(profileProp);
  const [chatId, setChatId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const [error, setError] = useState("");

  // Permissions
  const [permLoading, setPermLoading] = useState(false);
  const [isAdminOrOwner, setIsAdminOrOwner] = useState(false);

  // Emoji
  const [emojiOpen, setEmojiOpen] = useState(false);

  // Scroll
  const listRef = useRef(null);

  // Voice
  const [isRecording, setIsRecording] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const myProfileId = useMemo(() => profile?.profile_id ?? null, [profile]);

  // 1) Load profile
  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (profileProp) {
        setProfile(profileProp);
        return;
      }
      try {
        if (!authUser?.id) return;

        const { data, error } = await supabase
          .from("profiles")
          .select("id, profile_id, name, avatar_url, is_agent")
          .eq("id", authUser.id)
          .single();

        if (error) throw error;
        if (!mounted) return;
        setProfile(data);
      } catch (e) {
        if (mounted) setError(e?.message || "Failed to load profile");
      }
    };

    run();
    return () => { mounted = false; };
  }, [authUser?.id, profileProp]);

  // 2) Get chatId
  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setLoading(true);
        setError("");
        setChatId(null);

        if (!authUser?.id) throw new Error("Not authenticated");

        const r1 = await supabase.rpc("get_my_agency_chat_id");
        let cid = r1.data || null;

        if (!cid && profile?.is_agent) {
          const r2 = await supabase.rpc("get_or_create_agency_chat");
          if (r2.error) throw r2.error;
          cid = r2.data || null;
        }

        if (!mounted) return;
        setChatId(cid);
      } catch (e) {
        if (mounted) setError(e?.message || "Failed to open chat");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (!profile && !profileProp) return;
    run();

    return () => { mounted = false; };
  }, [authUser?.id, profile, profileProp]);

  // 2.1) Permission check
  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        if (!chatId || !authUser?.id) return;
        setPermLoading(true);

        const r = await supabase.rpc("is_agency_chat_admin_or_owner", { p_chat_id: chatId });
        if (mounted) setIsAdminOrOwner(r?.data === true);
      } catch {
        if (mounted) setIsAdminOrOwner(false);
      } finally {
        if (mounted) setPermLoading(false);
      }
    };

    run();
    return () => { mounted = false; };
  }, [chatId, authUser?.id]);

  // 3) Load messages + sender profiles
  useEffect(() => {
    let mounted = true;
    if (!chatId) return;

    const load = async () => {
      try {
        setError("");

        const { data, error } = await supabase
          .from("agency_messages")
          .select("id, chat_id, sender_profile_id, content_type, content, attachment_url, created_at, deleted_at, deleted_by_profile_id")
          .eq("chat_id", chatId)
          .order("created_at", { ascending: true })
          .limit(500);

        if (error) throw error;
        if (!mounted) return;

        const list = Array.isArray(data) ? data : [];
        setMessages(list);

        const senderIds = Array.from(new Set(list.map((m) => m.sender_profile_id).filter(Boolean)));
        if (senderIds.length) {
          const { data: pData } = await supabase
            .from("profiles")
            .select("profile_id, name, avatar_url")
            .in("profile_id", senderIds);

          if (Array.isArray(pData)) {
            const mp = {};
            for (const p of pData) mp[p.profile_id] = p;
            if (mounted) setProfilesMap(mp);
          }
        }
      } catch (e) {
        if (mounted) setError(e?.message || "Failed to load messages");
      }
    };

    load();
    return () => { mounted = false; };
  }, [chatId]);

  // 4) Realtime: INSERT + UPDATE
  useEffect(() => {
    if (!chatId) return;

    const channel = supabase
      .channel(`agency_chat_${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agency_messages", filter: `chat_id=eq.${chatId}` },
        async (payload) => {
          const row = payload.new;
          setMessages((prev) => (prev.some((x) => x.id === row.id) ? prev : [...prev, row]));

          const sid = row?.sender_profile_id;
          if (sid && !profilesMap[sid]) {
            const { data } = await supabase
              .from("profiles")
              .select("profile_id, name, avatar_url")
              .eq("profile_id", sid)
              .maybeSingle();
            if (data) setProfilesMap((p) => ({ ...p, [sid]: data }));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "agency_messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const row = payload.new;
          setMessages((prev) => prev.map((m) => (m.id === row.id ? row : m)));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Auto scroll
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  const canDeleteMessage = (m) => {
    if (!myProfileId) return false;
    const isMine = m.sender_profile_id === myProfileId;
    return isMine || isAdminOrOwner;
  };

  const sendText = async () => {
    try {
      const msg = (text || "").trim();
      if (!msg || !chatId) return;
      if (!myProfileId) throw new Error("Missing profile_id");

      setSending(true);
      setError("");

      const { error } = await supabase.from("agency_messages").insert({
        chat_id: chatId,
        sender_profile_id: myProfileId,
        content_type: "text",
        content: msg,
        attachment_url: null,
      });

      if (error) throw error;
      setText("");
      setEmojiOpen(false);
    } catch (e) {
      setError(e?.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  const sendFile = async (file) => {
    try {
      if (!file || !chatId) return;
      if (!myProfileId) throw new Error("Missing profile_id");

      setUploading(true);
      setError("");

      const bucket = "agency_attachments";
      const ext = (file.name || "file").split(".").pop();
      const safeExt = ext ? ext.toLowerCase() : "bin";
      const path = `agency/${chatId}/${Date.now()}_${Math.random().toString(16).slice(2)}.${safeExt}`;

      const up = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });
      if (up.error) throw up.error;

      const pub = supabase.storage.from(bucket).getPublicUrl(path);
      const url = pub?.data?.publicUrl;
      if (!url) throw new Error("Failed to get public URL");

      const ctype = guessType(file);

      // image: OK
      if (ctype === "image") {
        const { error } = await supabase.from("agency_messages").insert({
          chat_id: chatId,
          sender_profile_id: myProfileId,
          content_type: "image",
          content: null,
          attachment_url: url,
        });
        if (error) throw error;
        return;
      }

      // file/audio: fallback إذا الداتابيز مش سامحة
      const res = await insertMessageWithTypeFallback(
        { chat_id: chatId, sender_profile_id: myProfileId, content: null, attachment_url: url },
        ctype,            // preferred: "audio" or "file"
        "voice"           // fallback (لو constraint القديم)
      );

      if (!res.ok) throw res.error;
    } catch (e) {
      setError(e?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      setError("");
      const r = await supabase.rpc("delete_agency_message", { p_message_id: messageId });
      if (r.error) throw r.error;

      if (r.data?.success !== true) {
        throw new Error(r.data?.error || "Delete failed");
      }
    } catch (e) {
      setError(e?.message || "Delete failed");
    }
  };

  // Voice
  const startRecording = async () => {
    try {
      setError("");
      setVoiceBlob(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);

      recorderRef.current = rec;
      chunksRef.current = [];

      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      rec.onstop = () => {
        try { stream.getTracks().forEach((t) => t.stop()); } catch {}
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setVoiceBlob(blob);
      };

      rec.start();
      setIsRecording(true);
      setEmojiOpen(false);
    } catch {
      setError("Microphone permission denied or not available.");
    }
  };

  const stopRecording = () => {
    try { recorderRef.current?.stop(); } catch {}
    setIsRecording(false);
  };

  const cancelVoice = () => {
    setIsRecording(false);
    setVoiceBlob(null);
    chunksRef.current = [];
    try { recorderRef.current?.stop(); } catch {}
  };

  const sendVoice = async () => {
    try {
      if (!voiceBlob || !chatId) return;
      if (!myProfileId) throw new Error("Missing profile_id");

      setUploading(true);
      setError("");

      const bucket = "agency_attachments";
      const file = new File([voiceBlob], `voice_${Date.now()}.webm`, {
        type: voiceBlob.type || "audio/webm",
      });

      const path = `agency/${chatId}/voice_${Date.now()}_${Math.random().toString(16).slice(2)}.webm`;

      const up = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

      if (up.error) throw up.error;

      const pub = supabase.storage.from(bucket).getPublicUrl(path);
      const url = pub?.data?.publicUrl;
      if (!url) throw new Error("Failed to get public URL");

      // preferred audio ثم fallback voice (للتوافق)
      const res = await insertMessageWithTypeFallback(
        { chat_id: chatId, sender_profile_id: myProfileId, content: null, attachment_url: url },
        "audio",
        "voice"
      );
      if (!res.ok) throw res.error;

      setVoiceBlob(null);
      chunksRef.current = [];
    } catch (e) {
      setError(e?.message || "Voice send failed");
    } finally {
      setUploading(false);
    }
  };

  const addEmoji = (em) => setText((t) => (t || "") + em);

  if (loading) {
    return (
      <div className={embedded ? "" : "bg-white rounded-2xl shadow-lg p-6"}>
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading chat...
        </div>
      </div>
    );
  }

  if (!chatId) {
    return (
      <div className={embedded ? "" : "bg-white rounded-2xl shadow-lg p-6"}>
        <div className="text-sm text-gray-600">
          مفيش شات متاح ليك دلوقتي. (تأكد إنك منضم لوكالة / أو افتح الشات من الوكيل أول مرة)
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "" : "bg-white rounded-2xl shadow-lg p-6"}>
      {error ? <div className="mb-3 text-sm text-red-600 whitespace-pre-line">{error}</div> : null}

      <div className="border rounded-xl overflow-hidden">
        {/* Messages */}
        <div ref={listRef} className="h-[60vh] overflow-y-auto p-4 bg-gray-50 space-y-3">
          {messages.length === 0 ? (
            <div className="text-sm text-gray-500">No messages yet.</div>
          ) : (
            messages.map((m) => {
              const sp = profilesMap?.[m.sender_profile_id];
              const name = sp?.name || `#${m.sender_profile_id}`;
              const avatar = sp?.avatar_url || DEFAULT_AVATAR;
              const isMine = myProfileId && m.sender_profile_id === myProfileId;

              if (m.deleted_at && !isAdminOrOwner) return null;

              const looksAudio =
                m.attachment_url &&
                (m.content_type === "audio" || m.content_type === "voice" || isAudioUrl(m.attachment_url));

              return (
                <div key={m.id} className={`flex gap-3 ${isMine ? "justify-end" : ""}`}>
                  {!isMine && (
                    <img
                      src={avatar}
                      alt={name}
                      className="w-9 h-9 rounded-full object-cover bg-white border"
                      onError={(e) => (e.currentTarget.src = DEFAULT_AVATAR)}
                    />
                  )}

                  <div className={`max-w-[78%] ${isMine ? "text-right" : ""}`}>
                    <div className="text-xs text-gray-500 mb-1 flex items-center justify-between gap-2">
                      <div>
                        {!isMine ? <span className="font-semibold text-gray-700">{name}</span> : "You"}
                        <span className="mx-2">•</span>
                        <span>{fmtTime(m.created_at)}</span>
                      </div>

                      {canDeleteMessage(m) && !m.deleted_at ? (
                        <button
                          onClick={() => deleteMessage(m.id)}
                          className="text-xs text-red-600 hover:text-red-700 inline-flex items-center gap-1"
                          title="Delete"
                          disabled={permLoading}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      ) : null}
                    </div>

                    <div className="rounded-2xl px-4 py-3 bg-white border">
                      {m.deleted_at ? (
                        <div className="text-sm italic text-gray-400">Message deleted</div>
                      ) : (
                        <>
                          {m.content_type === "text" && (
                            <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                          )}

                          {m.attachment_url ? (
                            <div className="text-sm mt-1">
                              {m.content_type === "image" ? (
                                <img src={m.attachment_url} alt="attachment" className="max-h-64 rounded-lg border" />
                              ) : looksAudio ? (
                                <audio controls src={m.attachment_url} className="w-full" />
                              ) : (
                                <a
                                  href={m.attachment_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 underline"
                                >
                                  Open file
                                </a>
                              )}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>

                  {isMine && (
                    <img
                      src={avatar}
                      alt={name}
                      className="w-9 h-9 rounded-full object-cover bg-white border"
                      onError={(e) => (e.currentTarget.src = DEFAULT_AVATAR)}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Emoji Picker */}
        {emojiOpen && (
          <div className="p-3 bg-white border-t">
            <div className="grid grid-cols-10 gap-1">
              {EMOJI_LIST.map((em) => (
                <button
                  key={em}
                  onClick={() => addEmoji(em)}
                  className="h-9 w-9 rounded-lg hover:bg-gray-100 text-lg"
                  title={em}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Voice Preview */}
        {voiceBlob && (
          <div className="p-3 bg-white border-t flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <audio controls src={URL.createObjectURL(voiceBlob)} className="w-full sm:flex-1" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={cancelVoice} disabled={uploading} className="flex-1">
                Cancel
              </Button>
              <Button onClick={sendVoice} disabled={uploading} className="flex-1">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Voice"}
              </Button>
            </div>
          </div>
        )}

        {/* Composer (موبايل: سطرين علشان الـ Input ما يضيقش) */}
        <div className="p-3 bg-white border-t">
          <div className="flex flex-col gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write a message…"
              onFocus={() => setEmojiOpen(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendText();
              }}
              disabled={sending || uploading || isRecording}
              className="h-12 text-base"
            />

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setEmojiOpen((v) => !v)}
                disabled={sending || uploading || isRecording}
                title="Emojis"
              >
                <Smile className="h-4 w-4" />
              </Button>

              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept="image/*,audio/*,.pdf,.doc,.docx,.zip,.rar,.txt"
                onChange={(e) => sendFile(e.target.files?.[0])}
              />

              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={sending || uploading || isRecording}
                title="Attach"
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              {!isRecording ? (
                <Button variant="outline" onClick={startRecording} disabled={sending || uploading} title="Record">
                  <Mic className="h-4 w-4" />
                </Button>
              ) : (
                <Button variant="destructive" onClick={stopRecording} disabled={uploading} title="Stop">
                  <Square className="h-4 w-4" />
                </Button>
              )}

              <Button onClick={sendText} disabled={sending || uploading || isRecording} className="ml-auto">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
              </Button>
            </div>
          </div>

          <div className="text-xs text-gray-500 mt-2">
            Storage bucket: <b>agency_attachments</b>
          </div>
        </div>
      </div>
    </div>
  );
}