# Heirloom: build plan (HackGT 13 demo)

> **Translation that fades. Fluency that stays.**
> Heirloom is a chat layer that translates conversations between people who don't share a language,
> and quietly teaches the learner the other person's language until the translation is no longer needed.
> Its learning engine is **LLTA** (Language Learning Translations Algorithm).

Source of truth for architecture and build order. Scope, personas and user stories: `docs/PROJECT.md`.
Live phase status: `docs/STATUS.md`. Decisions: `docs/DECISIONS.md`. Rules: `AGENTS.md`.
Procedures: `.claude/skills/`. Work one phase at a time; mark it done in `docs/STATUS.md` only
when every done-criterion passes.

---

## 1. Scope

### 1.1 What we are building
A **demo** app built with **React Native + Expo SDK 57**, deployed as a **web build** and used in
**Safari on real iPhones** (added to the home screen, full-screen like a native messenger). The code
stays **mobile-ready**: it must also run as a native iOS/Android app later without a rewrite (§7.8),
but native builds are not part of this demo. It reuses the existing v0 backend.

### 1.2 Cast and seeded chats

| Person | Speaks | Profile id | Role in demo |
|---|---|---|---|
| **Arjun** | English | `…0001` | The learner. Heirloom on in both chats |
| **Abuela** | Spanish | `…0003` | Grandparent. Chats normally; Heirloom off |
| **Zara** | Urdu | `…0005` | Friend. Chats normally; Heirloom off |

Threads: **Arjun ↔ Abuela** `…00a2` (Arjun learns Spanish), **Arjun ↔ Zara** `…00a4` (Arjun learns Urdu).
Ids are `00000000-0000-0000-0000-` + the suffix, padded to 12 hex digits.
Hindi and English are selectable in the language picker (the pipeline must handle them) but not seeded.
Nani and any other v0 profiles stay in the database and are hidden from the persona picker.

### 1.3 Core features (user stories in `docs/PROJECT.md`)
1. **Per-chat Heirloom toggle with language selection.** Each user turns Heirloom on or off per chat and
   picks the language they're learning; that chat then counts toward their progress in that language.
   Learning is **one-sided and opt-in**.
2. **Voice-to-voice voice notes.** Transcribed, translated and spoken back in the listener's language
   within seconds (v0 pipeline). Not live calls.
3. **Transcription box on every message.** Every word of the original is tappable. Tapping expands a card
   under the bubble: **Section 1** full translation with the matching words highlighted plus a grammar
   note; **Section 2** cultural context for idioms and phrases with **View more** (bottom sheet).
   Tapping a word in the **translation** highlights its match in the original too (§5.3 `tSpans`).
4. **The fade.** Translation first → original first → translation hidden → translation removed (§7.4).
5. **Progress tab.** One card per language. **Mastered / Learning / New** word lists with audio, two
   insight charts, and a 5-word practice quiz.
6. **Demo mode.** Seeded 8-week history plus a hidden **time-travel slider** replaying the event log
   through the real learner model.

**Stretch (only after Phase 7 passes):** "I know this / Still learning" buttons in the word card
(requires the learner-model-change procedure), and "Ask more" in the View more sheet.

### 1.4 Out of scope (do not build)
Live voice calls, native store builds, logins/auth, group chats, multiple skins, reply mix-in
suggestions, pronunciation scoring, push notifications, voice cloning, offline support, streaks,
points, badges, an AI tutor chatbot. Hindi and English get no seeded chats.

### 1.5 Honesty rules
- Voice translation is "near-realtime voice notes", never "live".
- Seeded history is labeled simulated in the write-up.
- Learner-model constants are hand-set defaults unless §10 E1 produces fitted values from a committed run.

---

## 2. Architecture

```
iPhone Safari (home-screen web app)
   │  HTTPS + WebSocket, same origin
   ▼
Render web service ── Express 5 + Socket.IO (server/)
   ├── serves the Expo web export (client/dist) as static files   [STATIC_DIR=client/dist]
   ├── REST /api/* + Socket.IO
   ├── OpenAI: gpt-4o-mini (translate, analyze), whisper-1 (transcribe), gpt-4o-mini-tts (speak)
   └── Supabase: Postgres + private Storage bucket (audio)

packages/learner/  pure TypeScript learner model, used by BOTH server and client
web/               v0 Vite client: untouched fallback until Phase 3 passes
```

- **One service, one URL.** The server already serves a built client in production; `STATIC_DIR`
  switches it from `web/dist` to `client/dist`. No CORS in production, CI-gated deploys stay as they are.
  Vercel is an allowed fallback only if Render static serving fails.
- **Server is the source of truth** for messages, analyses and mastery.
- **Client applies learning events optimistically** with the same `packages/learner` functions, then syncs.
  This also powers the time-travel slider (client-side replay).
- **API keys live only on the server.** The client knows only the API URL.

---

## 3. Stack and approved dependencies

Expo **SDK 57** (latest patch, 57.0.25 as of Sep 26, 2026). SDK 57 pins **React Native 0.86.3**,
**React 19.2.3**, **react-native-reanimated 4.5.1**, **react-native-worklets 0.10.1**,
**react-native-gesture-handler ~2.32**. npm's "latest" is newer for several of these (0.87, 4.7, 3.x);
**never** install those. Install every Expo-managed package with `npx expo install <pkg>` from `client/`.

| Purpose | Package | Notes |
|---|---|---|
| Framework | `expo`, `react`, `react-dom`, `react-native`, `react-native-web`, `@expo/metro-runtime` | Web target for the demo |
| Routing | `expo-router` (+ `react-native-screens`, `react-native-safe-area-context`, `expo-linking`, `expo-constants`) | Web output `"single"` (SPA) |
| Audio | `expo-audio` | Playback everywhere; web recording verified in Phase 0, fallback `recorder.web.ts` |
| Animation | `react-native-reanimated` + `react-native-worklets` | Gloss dissolve, stage-up, sheet |
| Gestures | `react-native-gesture-handler` | Long-press reveal, sheet drag |
| Visuals | `expo-linear-gradient`, `expo-image`, `react-native-svg`, `@expo/vector-icons` | Gradient bubbles, avatars, hand-rolled charts, icons |
| Fonts | `expo-font`, `@expo-google-fonts/inter`, `@expo-google-fonts/noto-nastaliq-urdu`, `@expo-google-fonts/noto-sans-devanagari` | Urdu needs Nastaliq |
| State | `zustand` | Session, threads, mastery, demo |
| Realtime | `socket.io-client` 4.x | Matches the server's Socket.IO 4 |
| Status bar | `expo-status-bar` | |
| Shared model | `@heirloom/learner` (workspace) | |

Dev tooling: `typescript`, `@biomejs/biome` (lint in hooks and CI). Tests use Node's built-in runner
(`node --test`) on compiled output. **Anything else needs human approval**; the list is enforced by
`scripts/allowed-deps.json` (CI + a Bash hook). Specifically not allowed: UI kits, chart libraries,
bottom-sheet libraries, TanStack Query, FlashList, test frameworks, `expo-av` (removed in SDK 55),
`expo-haptics` (no effect on the web; revisit for native).

---

## 4. Repo layout (target)

```
client/                         NEW Expo app (web target, mobile-ready)
  app/                          expo-router routes
    _layout.tsx                 fonts, theme, socket provider, BottomSheetHost
    +html.tsx                   web <head>: PWA meta tags, viewport (web only by definition)
    index.tsx                   persona picker ("Who are you?")
    (tabs)/_layout.tsx          tab bar: Chats, Progress
    (tabs)/chats.tsx            chat list
    (tabs)/progress.tsx         languages overview
    chat/[threadId].tsx         conversation
    progress/[lang].tsx         language detail + word lists
    practice/[lang].tsx         practice quiz
  src/
    api/                        rest.ts, socket.ts, types.ts (mirrors server types)
    audio/                      player.ts, recorder.ts (+ recorder.web.ts if needed)
    components/                 see §7.2
    learning/                   useLearner.ts, eventQueue.ts, demoReplay.ts
    store/                      session.ts, threads.ts, learner.ts, demo.ts, sheet.ts
    theme/                      tokens.ts, typography.ts
  app.json                      web output "single", PWA manifest fields
packages/learner/               pure TS learner model (scaffolded; Phase 1 fills it)
  src/constants.ts model.ts render.ts stage.ts practice.ts replay.ts index.ts
  test/*.test.ts                parity + scenario tests (node --test)
  fixtures/                     JSON exported by docs/reference/learner_model.py
server/                         EXISTING, extended (§6)
  src/learning/                 learning routes and queries
  src/scripts/seedDemo.ts       demo seed (§9.1)
supabase/001_init.sql           existing, never edit
supabase/002_learning.sql       NEW
docs/reference/learner_model.py reference implementation (Sarosh's)
analysis/                       evaluation notebooks and exported charts (§10)
web/                            v0 Vite client: leave untouched
```

Root npm `workspaces`: `packages/learner`, `server`, `web`, `client` (add `client` in Phase 0).
Expo SDK 52+ configures Metro for monorepos automatically; don't hand-edit `metro.config.js`
unless resolution fails. `packages/learner` is consumed as built JS (`dist/`); `npm run dev` watches it.

---

## 5. Data model

### 5.1 Existing tables (v0, unchanged)
`profiles`, `threads`, `thread_members`, `messages` (kind, original_text, original_language,
audio_path, word_timestamps, status), `message_translations` (per message per language: text,
optional audio_path).

### 5.2 New tables (`supabase/002_learning.sql`)
Row-level security ON with no policies (server key only), as in v0.

| Table | Primary key | Columns |
|---|---|---|
| `thread_settings` | (`thread_id`, `profile_id`) | `learning_enabled bool default false`, `learning_lang text null`, `updated_at` |
| `message_analyses` | (`message_id`, `viewer_lang`) | `tokens jsonb`, `phrases jsonb`, `translation text`, `model text`, `needs_native_check bool default true`, `failed bool default false`, `created_at` |
| `word_notes` | (`lang`, `lemma`, `viewer_lang`) | `grammar text`, `culture text`, `usage text`, `examples jsonb`, `is_idiom bool`, `created_at` |
| `learning_events` | `id` uuid | `profile_id`, `lang`, `lemma`, `form`, `event_type`, `message_id null`, `thread_id null`, `options int null`, `romanization_shown bool`, `created_at timestamptz` (client-supplied allowed for seeding) |
| `word_mastery` | (`profile_id`, `lang`, `lemma`) | `state jsonb` (serialized `LemmaState`), `updated_at` |

Indexes: `learning_events (profile_id, lang, created_at)`, `message_analyses (message_id)`.
Learner tables hold lemmas and counters only, never message text.

### 5.3 Shared types (`client/src/api/types.ts` mirrors server)

```ts
type Lang = 'en' | 'es' | 'ur' | 'hi';

interface Token {
  i: number;                  // position in the original text
  surface: string;            // as written
  lemma: string;              // dictionary form: the mastery key
  romanization?: string;      // required for ur and hi
  gloss: string;              // meaning in the viewer's language
  pos?: string;
  grammar?: string;           // one short line
  phraseId?: string;          // member of a multi-word unit
  isPunct?: boolean;          // not tappable, not tracked
  tSpans?: [number, number][];// char ranges in `translation` this token maps to (merge addition)
  start?: number; end?: number; // seconds, voice notes only (Whisper word timestamps)
}

interface Phrase {
  id: string;
  tokenIndices: number[];
  meaning: string;            // idiomatic meaning in the viewer's language
  isIdiom: boolean;
  culture?: string;           // only when genuine; never invented
  tSpans?: [number, number][];
}

interface MessageAnalysis {
  messageId: string; viewerLang: Lang;
  translation: string;        // full translation; tSpans index into this
  tokens: Token[]; phrases: Phrase[];
  needsNativeCheck: boolean; failed?: boolean;
}
```

`tSpans` powers Section 1 highlighting and the reverse direction: tapping a translation word finds the
token or phrase whose span covers it and highlights the original.

---

## 6. Server changes (`server/`)

### 6.1 Pipeline: add an **analyze** step
Unchanged: save as `processing` → emit `message:new` → translate (voice: transcribe → translate →
synthesize) → save → `ready` → emit `message:updated`.

New, after `message:updated`:
1. Find members with `learning_enabled = true` whose `learning_lang` equals the message's original
   language, excluding the sender.
2. For each distinct viewer language, if no cached `message_analyses` row exists, call
   `analyzeMessage(text, originalLang, viewerLang)` in `server/src/ai.ts`.
3. For voice notes, attach Whisper word timestamps to tokens (match in order on normalized surface).
4. Save, then emit `analysis:ready { messageId, viewerLang }` to the thread room.

Text and audio never wait on analysis. A failed analysis leaves the message readable (plain transcript).
Turning Heirloom on for a thread backfills analyses for its last 30 messages in the background.

### 6.2 `analyzeMessage`
- Model: `OPENAI_ANALYZE_MODEL`, default `gpt-4o-mini`. Structured outputs (JSON schema for `Token[]`,
  `Phrase[]`, `translation`, including `tSpans`).
- Prompt: split exactly on the original (joined surfaces reproduce it); lemmatize; romanization mandatory
  for `ur` and `hi`; flag idioms and multi-word expressions as phrases; one-line beginner grammar;
  cultural notes only when genuine; `tSpans` must be valid ranges of `translation`.
- Validate: surfaces rejoin to the original, `tSpans` in range. One retry; then store `failed = true`.

### 6.3 `explainWord` ("View more")
Generated on first request per (`lang`, `lemma`, `viewer_lang`), cached in `word_notes`. Usage, 2–3
examples (prefer real sentences from the same user's threads, passed as context), grammar, culture.

### 6.4 Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/threads/:id/settings?profileId=` | This user's toggle + language for the thread |
| PUT | `/api/threads/:id/settings` | `{profileId, learningEnabled, learningLang}`; backfill when turned on |
| GET | `/api/messages/:id/analysis?lang=` | Cached analysis, or 404 while pending |
| GET | `/api/words/:lang/:lemma/notes?viewerLang=&profileId=` | View-more content (generate + cache) |
| POST | `/api/events` | `{profileId, events: LearningEvent[]}`; applies via `packages/learner`; returns changed mastery |
| GET | `/api/profiles/:id/mastery?lang=` | Full mastery map |
| GET | `/api/profiles/:id/progress` | Languages: stage, fade %, counts, contributing threads |
| GET | `/api/profiles/:id/progress/:lang` | Word lists (mastered, learning, new, fading) + weekly history |
| GET | `/api/profiles/:id/events?lang=` | Raw event log (demo replay) |
| GET | `/api/practice/:profileId/:lang` | 5 quiz items: sentence, highlighted token, 4 options |
| POST | `/api/words/ask` | Stretch: scoped follow-up question about one word or phrase |

Socket events: `analysis:ready` (thread room), `mastery:updated` (room `profile:<id>`, joined on connect).

### 6.5 Hosting
- Render (existing service). Production: `NODE_ENV=production`, `STATIC_DIR=client/dist`; the build runs
  the Expo web export (Phase 0). CI must pass before deploy (existing setting).
- Dev: Expo runs on `http://localhost:8081` and calls the API at `EXPO_PUBLIC_API_URL`
  (`http://localhost:4000`); add `http://localhost:8081` to `WEB_ORIGIN` for CORS.
- Free instances sleep: pre-warm 2 minutes before filming, or switch to Starter before Expo.

---

## 7. Client (`client/`)

### 7.1 Screens
- **Persona picker** (`index.tsx`): large avatars for Arjun, Abuela, Zara. Stored in the session store and
  the URL (`?as=arjun`) so each iPhone keeps its identity.
- **Chats tab:** avatar, name, last message preview, time; a small gold ✦ where Heirloom is on.
- **Conversation:** header (back, avatar, name, "Active now", Heirloom chip), inverted list, composer.
- **Chat settings sheet** (from the chip): Heirloom toggle, "I'm learning" picker (Spanish, Urdu,
  Hindi, English), stage and fade %.
- **Progress tab:** language cards. **Language detail:** stats, 2 charts, word lists, Practice.
- **Practice:** 5 questions, one at a time, results.

### 7.2 Components
`ChatListItem`, `ChatHeader`, `HeirloomChip` (language + stage + progress ring), `MessageBubble`,
`VoicePlayer` (tap to play, waveform from `react-native-svg`, Translated / Their voice toggle),
`TranscriptBox` (tappable tokens, karaoke), `TranslationText` (tappable via `tSpans`), `WordCard`,
`BottomSheet` + `BottomSheetHost`, `WordNotesSheet`, `StageUpCard`, `Composer`, `LanguageCard`,
`WordRow`, `MiniChart`, `QuizCard`, `DemoPanel`.

### 7.3 Visual system (one Messenger-style skin + Heirloom gold)
Evoke Meta's messaging conventions; never copy them. No Meta logos, wordmarks, app names or assets.

| Token | Value | Use |
|---|---|---|
| `bubbleSent` | gradient `#0A7CFF` → `#8B3DFF` (top to bottom) | Learner's bubbles |
| `bubbleReceived` | `#EFEFF1` | Other person |
| `textOnSent` | `#FFFFFF` | |
| `textPrimary` / `textSecondary` | `#0B0B0C` / `#65676B` | |
| `background` | `#FFFFFF` | |
| `heirloom` | `#C9922E`, tint `#FBF3E4` | Everything Heirloom adds: chip, underlines, card border, link highlight, stage-up |
| `mastered` | `#2E9E6B` | Progress |
| `fading` | `#D9822B` | Fading marker |

Inter 400/500/600; body 16px; bubble radius 18 with 4 on the tail corner; 2px spacing within a group,
10px between groups. Everything Heirloom adds is gold, so viewers see the layer on top of the chat.

### 7.4 The fade
Stage is per user **per language** (never per bubble), from the share of tracked tokens in the last 20
received messages whose words are mastered, with a 5-point buffer before dropping a stage.

| Stage | Readable share | Main text | Secondary | Inline hints | Voice default |
|---|---|---|---|---|---|
| **Listener** | < 30% | Translation | Original, small, tappable | Every tracked word | Translated voice |
| **Reader** | 30–70% | Original | Translation collapsed ("Show translation") | Unmastered words | Their voice + karaoke |
| **Conversant** | 70–90% | Original | Long-press only | New and fading words | Their voice |
| **Fluent** | ≥ 90% | Original | None (long-press safety net) | Brand-new words only | Their voice |

Moments (Reanimated, must work on web): gloss dissolve with "You know this now" (1.2s); stage-up card
(Fluent: "Translation off for Spanish. You don't need it anymore."); "✦ Read on your own" tag on bubbles
read with zero taps; header ring animates.

### 7.5 Transcript and word card
- One outer `<Text>` with a nested `<Text onPress>` per token and the original whitespace between, so
  wrapping and bidirectional text are handled for us (works on web and native).
- Token styles: `new`/`learning` → gold dotted underline + small gloss when the stage shows hints;
  `mastered` → plain; `fading` → orange underline; `challenge` → gold outline with "?"; punctuation plain.
- Phrases highlight together when any member is tapped.
- Tapping opens `WordCard` under the bubble: header (word, romanization, meaning, "Hear it" for voice
  notes: plays original audio from `start` to `end`); Section 1: translation with `tSpans` highlighted
  (gold tint) + grammar; Section 2 (phrase or culture): meaning, how to use it, **View more**.
- One card open at a time; tapping outside closes it.

### 7.6 Urdu and right-to-left
`writingDirection: 'rtl'`, `textAlign: 'right'` per Urdu bubble and transcript; never `I18nManager`.
Noto Nastaliq Urdu with line height ~2.0. Romanization shown until the script skill passes
`ROMANIZATION_OFF_R`. Always index tokens by `token.i`, never by screen position.

### 7.7 Audio
- No autoplay on iOS Safari: playback always starts from a tap; show loading within 100ms.
- Recording needs HTTPS and a mic permission prompt from a tap. iOS Safari records MP4/AAC (Whisper accepts).
  Upload multipart to the existing `POST /api/threads/:id/voice`.
- Stop all mic tracks after recording.

### 7.8 Mobile-ready rules (so a native build works later)
- Only React Native primitives and Expo modules in shared code. No DOM elements, no CSS files.
- Browser APIs (`window`, `document`, `navigator`, `MediaRecorder`, storage) only in `*.web.ts(x)` files,
  each with a native counterpart (`*.ts(x)`), even if the native one is a stub. `npm run lint` enforces this.
- API base URL from `EXPO_PUBLIC_API_URL`; on web it may default to the page origin, on native it's required.
- Safe areas via `react-native-safe-area-context`; gestures via gesture handler; sheets via Reanimated.
- Optional check if time allows: open the app in Expo Go on one phone. Not a done-criterion.

### 7.9 PWA polish
`+html.tsx`: `apple-mobile-web-app-capable`, status bar style, `viewport-fit=cover`, theme color,
apple-touch-icon (original Heirloom mark). `app.json` web manifest name "Heirloom".

---

## 8. Learner model (`packages/learner`)

Direct TypeScript port of `docs/reference/learner_model.py`. Pure functions only; callers pass `now`.

### 8.1 State per word (per user, per language)
Skills per lemma: `recognize`, `script` (reading without romanization), `produce`. Each skill:
`stability` (half-life, days), `lastReview`, `successDays`, `successes`, `failures`, `history`.
Per lemma: `difficulty` (0–1), `formsSeen`, `contexts` (thread ids), `encounters`, `wasMastered`.
Recall: `R = 2^(−daysSinceLastReview / stability)` (half-life regression, Settles & Meeder 2016).

### 8.2 Constants (identical to the Python reference; already in `src/constants.ts`)
`TARGET_RETENTION 0.90`, `MASTERED_R 0.90`, `FADING_R 0.70`, `ROMANIZATION_OFF_R 0.80`, `MIN_S 0.1`,
`MAX_S 365`, `SUCCESS_GAIN 2.5`, `FAIL_KEEP 0.4`, `RELEARN_FLOOR 0.8`, `MASTERY_MIN_S 7.0`,
`EXPOSURE_GAIN 0.25`, `SPACING_CAP 3.0`, `INFLECTION_TRANSFER 0.85`, `CHALLENGE_DENSITY 0.05`,
`MIN_CHALLENGES 2`, `CHALLENGE_BAND [0.35, 0.90]`, `D_LEARNING_RATE 0.05`.

### 8.3 Events → evidence

| Event | UI trigger | Evidence (skill, kind, weight) |
|---|---|---|
| `exposure_hinted` | Hinted word in a message viewed ≥ 2.5s | recognize, exposure, 0.3 |
| `read_unaided` | Unhinted word in a message viewed ≥ 2.5s, no tap | recognize, success, 0.4 (+ script success if romanization hidden) |
| `tap_reveal` | Tap on a hinted/unknown word | recognize, failure, 1.0 |
| `tap_explore` | Tap on a mastered word, or on a translation word | none (curiosity is never penalized) |
| `guess_correct` | Practice or in-chat guess, 4 options | recognize, success, 1.0 × (1 − 1/4) |
| `guess_wrong` | | recognize, failure, 1.0 |
| `audio_play` | "Hear it" on a word | recognize, exposure, 0.2 |
| `show_translation` | Opened the full translation of a message | recognize, failure, 0.3 on its unhinted tokens |

(`used_suggested` / `used_unprompted` exist in the reference but have no UI trigger in this demo.
Stretch events `mark_known`, `mark_learning` require the learner-model-change skill.)

### 8.4 Update rules
- First contact: `stability = 0.3 + 2.0 × (1 − difficulty)` (halved for exposure; × 0.4 for failure).
- Success: `stability ×= 1 + w × 2.5 × (1 − difficulty) × spacing`, `spacing = min(3, (1 − R_before) / 0.10)`.
- Failure: `stability = max(stability × (1 − w × 0.6), 0.8 × initialStability)`.
- Exposure: `stability ×= 1 + w × 0.25 × spacing × (1.5 if seen in 2+ threads else 1)`.
- Difficulty (graded events): `difficulty += 0.05 × w × (R_before − outcome)`, clamped 0.05–0.95.
- Clamp stability to 0.1–365 days.

### 8.5 Status and rendering
- `mastered`: R ≥ 0.90, stability ≥ 7 days, successes on ≥ 2 different days. `fading`: was mastered, now
  R < 0.70. Otherwise `learning` / `new`.
- `renderPlan(tokens, mastery, now)` → per token `hint`, `partialHint`, `romanization`, `challenge`
  (up to `max(2, 5% of tokens)` words with R in 0.35–0.90), plus message `fadePct`.
- `languageStage(mastery, recentTokens, previousStage)` → §7.4. `practiceItems(mastery, sentences, now, k=5)`.
- `replay(events, untilMs)` → mastery snapshot (slider and seed).

### 8.6 Tests
- **Parity:** fixtures exported from the Python reference with fixed seeds into `fixtures/`; must match within 1e-6.
- **Scenarios** (plain-language behavior): 5 taps then 1 unaided read stays unmastered; curiosity taps
  change nothing; mastery needs successes on 2 days; a long gap turns mastered into fading.
- Run with `npm test` (compiles, then `node --test`). Runs in CI.

---

## 9. Demo mode

### 9.1 Seed script (`server/src/scripts/seedDemo.ts`, `npm run seed:demo`) — built in Phase 2b
- Idempotent and namespaced to the demo profiles, their two threads and their messages/events. Never
  deletes or modifies other rows (the database is shared).
- ~40 messages per thread across 8 weeks, recurring everyday vocabulary (weather, food, school, health,
  plans, affection); ~30% voice notes with synthesized original-language audio and timestamps.
- 3 hero messages per thread from `server/src/scripts/heroMessages.json`, written or approved by a native
  speaker, at least one idiom each. Everything else keeps `needs_native_check = true`.
- Analyses pre-generated; Arjun's events simulated with `packages/learner` and the Python demo's behavior
  model; mastery rebuilt from the log. `thread_settings`: Arjun learning Spanish and Urdu; others off.
- Prints a summary: messages per thread, events per language, final stage per language.

### 9.2 Time-travel slider
Hidden `DemoPanel` (long-press the Heirloom chip 1.5s, or `?demo=1`). Week 1…8 + Now. Fetches the event
log once, replays events up to the chosen week with `replay()`, re-renders messages and Progress. Messages
don't change, only how they render. Target: re-render within 300ms on an iPhone. Read-only: never logs events.

### 9.3 Demo video beats (2–3 minutes, Meta challenge)
1. Week 1: Abuela's Spanish voice note → translated voice, translation-first bubble.
2. Tap a word → card → an idiom → View more.
3. Slider to Week 4 and Week 8: the same chat fades; glosses dissolve; stage-up card.
4. Zara's Urdu chat: right-to-left script, romanization fading separately.
5. Progress tab: two language cards, word lists, one practice question.
6. One evaluation chart (§10) for the AI/ML track. Close on the tagline.

---

## 10. Evaluation (AI/ML track evidence) — Lexi, parallel from Phase 1

The track rewards ML and visualization; the app alone is not enough. Keep it light and honest.

- **E2 simulator (required):** `packages/learner/src/sim/` (pure, seeded RNG passed in). 200 simulated
  learners with hidden true forgetting rates, 8 weeks of the seeded vocabulary, noisy behavior (skimming,
  stray taps). Compare: our model vs no fading vs a counting rule ("known after 3 unaided reads").
- **Charts (required, 3):** forgetting curves for 3 words with interactions marked; readable share per
  week vs the no-fade baseline, with the 95% comprehension line; calibration (predicted vs actual recall).
  Exported as SVG/PNG into `analysis/out/` using the app's colors. One goes in the video.
- **E1 fit (optional):** half-life regression on Duolingo's public traces for forgetting dynamics only.
  If not done, the write-up says constants are hand-set.
- Never report a number without the committed run that produced it; quote seed and learner count.

---

## 11. Phases (build in order)

Owners: **Victor** (client), **Sarosh** (server, analysis, seed), **Lexi** (learner model, evaluation,
Progress data). Times are Saturday/Sunday targets; slide them together if Phase 0 runs late.
Freeze at 2:30 AM. Submit to Devpost **and** expo.hexlabs.org by 5:00 AM (hard deadline 8:00 AM).

### Phase 0: Foundations and spikes — Victor (target 7:30 PM)
- Create `client/` (Expo SDK 57, expo-router, web output single); add `client` to workspaces; approved
  packages via `npx expo install`; persona picker skeleton listing threads from the API.
- Render: build runs the Expo web export; `STATIC_DIR=client/dist` (keep `web/dist` until Phase 3 passes).
- **Spike:** record 5s of audio in iOS Safari on the Render HTTPS URL with `expo-audio`, upload to
  `/api/threads/:id/voice`, get a transcript. If it fails on web, write `recorder.web.ts` (`MediaRecorder`)
  and record the decision in `docs/DECISIONS.md`.

**Done when:** the Render URL loads the Expo app on an iPhone, lists threads, and a voice note recorded in
Safari round-trips to a transcript.

### Phase 1: Learner package — Lexi (target 9:00 PM; parallel with 0, 2, 3)
Port §8 with parity fixtures and scenario tests. **Done when:** `npm test` passes; typecheck passes.

### Phase 2: Server learning layer — Sarosh (target 9:30 PM)
`002_learning.sql`, settings endpoints, analyze step + `analysis:ready`, word notes, events/mastery/
progress/practice/events-log endpoints, backfill on toggle.
**Done when:** a message in a thread where the reader has Heirloom on stores an analysis whose surfaces
rejoin to the original and whose `tSpans` are valid; posting events updates `word_mastery`; typecheck,
build and doctor pass.

### Phase 2b: Seed script — Sarosh (target 10:30 PM; moved earlier so Phases 4–7 have real data)
§9.1. **Done when:** a fresh run prints the summary, is idempotent on rerun, and Spanish reaches at least
Reader by Week 8.

### Phase 3: Chat core — Victor (target 9:30 PM)
Chat list, conversation, bubbles, composer (text + voice), live updates, voice player with Translated /
Their voice toggle, Messenger-style skin, PWA meta.
**Done when:** on two iPhones via the Render URL, Arjun and Abuela exchange text and voice notes live,
each in their own language. Then switch Render to `STATIC_DIR=client/dist` permanently.

### Phase 4: Heirloom layer — Victor, with Sarosh (target 11:30 PM)
Settings sheet, Heirloom chip, transcript tokens, translation spans, word card, View more sheet, Urdu RTL
and fonts, karaoke highlight.
**Done when:** tapping any word in a Spanish or Urdu message opens the correct card (right word under RTL),
tapping a translation word highlights its original, View more loads cached notes, and toggling Heirloom
off returns the chat to plain translation.

### Phase 5: The fade — Victor, with Lexi (target 12:45 AM)
Event logging (viewability, taps), optimistic updates, stage computation, four stage layouts, gloss
dissolve, stage-up card, "Read on your own".
**Done when:** posting events moves a word new → mastered and its gloss dissolves; stage changes the
layout per §7.4.

### Phase 6: Progress and practice — Lexi, with Victor reviewing (target 1:45 AM)
Progress tab, language detail with lists and 2 charts (readable share over time, messages per week),
practice quiz feeding events.
**Done when:** Spanish and Urdu cards show correct counts from the server; a practice session updates the lists.

### Phase 7: Demo mode and polish — Victor + Sarosh (target 2:30 AM = freeze)
Time-travel slider, PWA icon, final visual pass, seed rerun from scratch, §10 charts exported.
**Done when:** from a fresh seed, the slider Week 1 → Week 8 moves the Spanish chat Listener → Conversant or
Fluent on an iPhone, within 300ms per step.

### Phase 8: Ship — everyone (2:30–5:00 AM)
Video (~3:30 AM), Devpost (Oracle of the Deep + Meta), `docs/WRITEUP.md`, README with the architecture
diagram, repo public (history scanned for keys), submit to both sites.

### Cut order if behind
1. Karaoke highlight → 2. Messages-per-week chart → 3. Practice quiz → 4. Urdu (keep Spanish) →
5. Stage-up animations (keep the instant layout change).
**Never cut:** word card, the fade, the slider, Progress word lists, one evaluation chart.

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Web recording on iOS Safari fails with `expo-audio` | Phase 0 spike; `recorder.web.ts` fallback |
| Wrong Urdu tokenization, lemmas or spans | Validate surfaces and spans; native-check hero messages; romanization always present |
| Pipeline latency 5–10s | Translation first; analysis arrives via `analysis:ready` |
| Expo web + Reanimated/gesture quirks on Safari | Test on an iPhone every phase, not at the end |
| Render cold start | Pre-warm or Starter plan before Expo |
| Shared Supabase data | Namespaced, idempotent seed; destructive SQL blocked by hook |
| Nastaliq clipping | Proper font, line height 2.0, iPhone test in Phase 4 |
| Hackathon Wi-Fi | Everything on HTTPS; phones can use cellular |
