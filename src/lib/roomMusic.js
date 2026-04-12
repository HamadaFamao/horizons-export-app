export class RoomMusicPlayer {
  constructor() {
    this.audioContext = null;
    this.sourceNode = null;
    this.gainNode = null;
    this.destination = null;
    this.currentAudio = null;
    this.isPlaying = false;
    this.volume = 0.8;
    this.onEnded = null;
  }

  getContext() {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.audioContext;
  }

  async playSong(fileUrl, lkRoom) {
    try {
      await this.stop();

      const ctx = this.getContext();
      if (ctx.state === 'suspended') await ctx.resume();

      this.currentAudio = new Audio();
      this.currentAudio.src = fileUrl;
      this.currentAudio.crossOrigin = 'anonymous';
      this.currentAudio.preload = 'auto';

      this.sourceNode = ctx.createMediaElementSource(this.currentAudio);
      this.gainNode = ctx.createGain();
      this.gainNode.gain.value = this.volume;
      this.destination = ctx.createMediaStreamDestination();

      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.destination);
      this.gainNode.connect(ctx.destination);

      if (lkRoom?.localParticipant) {
        const audioTrack = this.destination.stream.getAudioTracks()[0];
        if (audioTrack) {
          await lkRoom.localParticipant.publishTrack(audioTrack, {
            name: 'music',
            source: 'music',
          });
        }
      }

      await this.currentAudio.play();
      this.isPlaying = true;

      this.currentAudio.onended = () => {
        this.isPlaying = false;
        if (this.onEnded) this.onEnded();
      };

      return true;
    } catch (err) {
      console.error('[ROOM_MUSIC_PLAY_ERROR]', err);
      return false;
    }
  }

  async stop() {
    try {
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.src = '';
        this.currentAudio = null;
      }
      if (this.sourceNode) {
        try { this.sourceNode.disconnect(); } catch {}
        this.sourceNode = null;
      }
      if (this.gainNode) {
        try { this.gainNode.disconnect(); } catch {}
        this.gainNode = null;
      }
      if (this.destination?.stream) {
        try { this.destination.stream.getTracks().forEach((track) => track.stop()); } catch {}
      }
      this.destination = null;
      this.isPlaying = false;
    } catch (err) {
      console.error('[ROOM_MUSIC_STOP_ERROR]', err);
    }
  }

  setVolume(value) {
    this.volume = value;
    if (this.gainNode) {
      this.gainNode.gain.value = value;
    }
  }

  pause() {
    if (this.currentAudio && this.isPlaying) {
      this.currentAudio.pause();
      this.isPlaying = false;
    }
  }

  resume() {
    if (this.currentAudio && !this.isPlaying) {
      this.currentAudio.play();
      this.isPlaying = true;
    }
  }

  getCurrentTime() {
    return this.currentAudio?.currentTime || 0;
  }

  getDuration() {
    return this.currentAudio?.duration || 0;
  }

  seekTo(seconds) {
    if (this.currentAudio) {
      this.currentAudio.currentTime = seconds;
    }
  }

  cleanup() {
    this.stop();
    try {
      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }
    } catch {}
  }
}

export const roomMusicPlayer = new RoomMusicPlayer();
