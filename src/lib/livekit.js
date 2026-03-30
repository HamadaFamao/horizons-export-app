import { Room, RoomEvent, Track } from "livekit-client";

if (!window.mutedUsers) window.mutedUsers = [];
if (!window.forcedMutedUsers) window.forcedMutedUsers = [];

/**
 * Connects to a LiveKit room, enables the local microphone,
 * and auto-attaches remote audio tracks so users can hear each other.
 *
 * @param {string} roomUrl - The LiveKit server URL (wss://...).
 * @param {string} token - The access token for the room.
 * @returns {Promise<Room>} The connected room instance.
 */
export async function connectVoice(roomUrl, token) {
  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
  });

  // Attach remote audio tracks so they can be heard
  const attachAudio = (track, participant) => {
    if (!track || track.kind !== Track.Kind.Audio) return;

    const participantId = participant?.identity;

    // 🔴 تحقق من حالة الميوت
    const isMuted =
      window.mutedUsers?.includes(participantId) ||
      window.forcedMutedUsers?.includes(participantId);

    if (isMuted) {
      console.log('[VOICE_BLOCKED]', participantId);
      return null;
    }

    const el = track.attach();
    el.autoplay = true;
    el.playsInline = true;

    document.body.appendChild(el);

    return el;
  };

  const attached = new Map(); // trackSid -> element

  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    const el = attachAudio(track, participant);
    if (el) attached.set(track.sid, el);
  });

  room.on(RoomEvent.TrackUnsubscribed, (track) => {
    const el = attached.get(track.sid);
    if (el) {
      try { track.detach(el); } catch { }
      try { el.remove(); } catch { }
      attached.delete(track.sid);
    }
  });

  await room.connect(roomUrl, token);

  return room;
}