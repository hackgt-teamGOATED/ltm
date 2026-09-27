---
name: expo-audio
description: 'Record and play voice notes with expo-audio on iOS Safari (and native), with the MediaRecorder web fallback. Use for VoicePlayer, Composer recording, and word clips.'
---

# Record and play audio

1. **Playback:** `expo-audio` player. Start only from a user tap (iOS blocks autoplay); show a loading
   state within 100ms. Never call play from an effect or socket handler.
2. **Recording:** request mic permission from the mic button tap; `expo-audio` recorder with a
   web-compatible preset. Needs HTTPS (Render) or localhost.
3. **Fallback** (only if the Phase 0 spike shows `expo-audio` recording fails in iOS Safari):
   `client/src/audio/recorder.web.ts` wraps `MediaRecorder` (`getUserMedia({ audio: true })`), prefers
   `audio/mp4` when supported, collects chunks, returns a Blob. Same interface as `recorder.ts`, which stays
   the `expo-audio` version for native. Record the decision in `docs/DECISIONS.md`.
4. Upload multipart (`senderId`, `audio`) to `POST /api/threads/:id/voice` with the right extension
   (`.m4a` for mp4/aac, `.webm` otherwise). The server already accepts both.
5. **Word clips ("Hear it"):** seek the original audio to `token.start`, play, pause at `token.end`.

**Guardrails:** stop all mic tracks after recording (the iOS red indicator must disappear); never use `expo-av`.
