# Heirloom: project brief (source of truth for scope)

> Heirloom is the demo messenger; **LLTA** (Language Learning Translations Algorithm) is the learning
> layer inside it. If a change conflicts with this file, stop and ask. How we build it: `PLAN.md`.

## One line

A chat layer that translates between people who don't share a language, and quietly teaches the learner
the other person's language from their own conversations, until the translation isn't needed.
**Translation that fades. Fluency that stays.**

## Hackathon context

- **Event:** HackGT 13. Hacking window Fri 8 PM to Sun 8 AM; no work outside it.
- **Track:** Oracle of the Deep (ML/AI + visualization). One track only.
- **Sponsor challenge:** Meta, "Bringing People Closer Together with AI". Judged on human connection, how
  essential AI is, originality, demo strength.
- **Meta deliverables:** working prototype, 2–3 minute video, public repo, short write-up (who it's for,
  how it strengthens connection, why AI is essential).
- **Team deadlines:** freeze 2:30 AM Sunday; submit to Devpost **and** expo.hexlabs.org by 5 AM.

## Abstract

Real-time translation in messaging exists, and it keeps people dependent on it forever. Heirloom adds
interactions to translated messages (tapping a word, reading without help, answering a quick guess,
replaying a voice note) that double as comprehension signals. A per-word, per-skill memory model learns
what the learner knows, and decides what each message shows: which words stay in the original language,
which get a hint, when to offer a guess. The LLM only annotates messages; the learner model decides.
Over weeks the interface moves from translation-first to original-first to original-only, and the other
person can see the learner reaching back in their language.

## People

| Persona | Who | Needs |
| --- | --- | --- |
| Learner: **Arjun** (English) | Second-generation grandson; talks to his Spanish-speaking grandmother and his Urdu-speaking friend | Talk now; learn their languages without homework |
| Grandparent: **Abuela** (Spanish) | Uses a familiar messenger | Nothing new to learn; to feel him making the effort |
| Friend: **Zara** (Urdu) | Close friend across a language gap | Same: a normal chat |
| Integrator | A messaging platform team (the Meta pitch) | Add the layer to an existing translated chat |

## User stories

Status: done, MVP (by freeze), stretch (only after Phase 7 passes).

| ID | Story | Acceptance | Status |
| --- | --- | --- | --- |
| US-1 | As a learner, messages arrive in my language, text and voice | Translated within seconds; voice notes get transcript, translation and audio | Done in v0; rebuilt in Phase 3 |
| US-2 | As a learner, I turn Heirloom on per chat and pick the language I'm learning | Off = plain translated chat; on = that chat counts toward that language | MVP |
| US-3 | As a learner, I tap any word and get a card with the translation (word highlighted), grammar and cultural context | Correct word even in Urdu RTL; tapping a translation word highlights its original | MVP |
| US-4 | As a learner, I open "View more" for usage and examples | Cached; examples from our own chats when possible | MVP |
| US-5 | As a learner, help fades as I improve | Listener → Reader → Conversant → Fluent per language; gloss dissolves on mastery | MVP |
| US-6 | As a learner, voice notes highlight word by word | Karaoke highlight from Whisper timestamps | MVP (first cut) |
| US-7 | As a learner, I see progress per language: Mastered / Learning / New lists with audio, charts, practice | Counts match the server; practice updates lists | MVP |
| US-8 | As a judge, I see the real model drive the UI | Slider replays the event log Week 1 → 8 through the model | MVP |
| US-9 | As a judge on the AI/ML track, I see evidence the model works | 3 evaluation charts from committed, seeded runs | MVP |
| US-10 | As the other person, I use a normal chat | No new controls | MVP |
| US-11 | As a learner, I correct the model ("I know this", "Still learning") | Logged as events via the model-change procedure | Stretch |
| US-12 | As a learner, I ask a follow-up about a word | Scoped answer in View more | Stretch |

## Scope

**In:** Expo app (web build, mobile-ready code), 1:1 threads, text and near-realtime voice notes,
analysis, learner model, fade stages, word card, View more, Progress tab, practice, demo seed, slider,
evaluation charts, docs.

**Out:** live calls, native store builds, logins, group chats, multiple skins, reply mix-in suggestions,
pronunciation scoring, push notifications, voice cloning, offline, streaks, points, badges, tutor chatbot,
seeded chats for Hindi or English.

## Principles

1. The fade is the product. If it doesn't help the translation visibly fade, or explain why, it waits.
2. Learning lives in the margins: optional, never blocking reading or replying. Curiosity is never penalized.
3. The LLM is a sensor, the model is the brain. No learning logic in prompts.
4. One model: the same `packages/learner` drives the server, the client, the slider and the evaluation.
5. The other person's side stays simple.
6. Privacy: learner tables hold lemmas and counters; keys never reach the client.
7. Honest demo: "near-realtime voice notes", simulated history labeled, no invented numbers or culture.

## Glossary

- **Analysis:** the LLM's structured output per message and viewer language: tokens, phrases, translation, `tSpans`.
- **Token / phrase:** a word or multi-word unit of the original, with lemma, romanization, gloss.
- **tSpans:** character ranges in the translation that a token or phrase maps to.
- **Lemma:** dictionary form; the mastery key.
- **Skill:** recognize, script, produce.
- **Stage:** Listener, Reader, Conversant, Fluent (per user per language).
- **Readable share:** share of tracked tokens in recent received messages that are mastered.
