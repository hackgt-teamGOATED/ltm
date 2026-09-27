## Inspiration

Translation apps are amazing, and they have a quiet side effect: they keep you dependent on them. Someone talking to a grandparent, or a close friend, across a language gap gets the message instantly and learns nothing. A year later they still need the translate button as much as on day one.

We wanted to flip that. If you are already reading a real conversation with someone you care about, that conversation is the best language course you will ever get: personal, motivating, and full of the words that actually matter to you. It just needs software that notices what you understand and gradually steps back.

So we built Heirloom around one idea: **translation that fades, fluency that stays.**

## What it does

Heirloom is a messenger where one person writes in English and the other reads in Spanish or Urdu, and back. Text and voice notes are translated, transcribed, and read aloud in the recipient's language. For the person on the other side it is just a normal chat.

For the learner, turning on Heirloom for a chat adds a learning layer:

- **Tap any word** to get a card with its meaning, grammar and cultural context. The matching word lights up in the translation, and it works right-to-left in Urdu (Nastaliq script). "View more" adds usage notes and examples from the learner's own chats.
- **Every interaction is a signal.** Reading a message without help, tapping a word, answering a quick guess, or replaying a voice note tells a per-word memory model what you know.
- **The interface fades with you.** Each language has four stages: Listener (translation first), Reader (original first, translation one tap away), Conversant (original only, long-press for help), and Fluent. When a word becomes truly known, its hint dissolves with a small "You know this now" moment.
- **A Progress tab** shows Mastered, Learning and New words per language, and how much of what you receive you can now read on your own.
- **A time-travel slider** replays an eight-week event log through the real model, so you can watch the translation fade from week 1 to week 8.

## How we built it

- **Client:** Expo / React Native for web, with expo-router, Zustand and Reanimated, built as a static web app that runs on an iPhone in Safari.
- **Server:** Node and Express with Socket.IO for live message updates, and Supabase (Postgres plus a private storage bucket) for chats, learning events and voice notes.
- **AI pipeline:** Whisper transcribes voice notes; GPT-4o-mini translates and breaks every message into words with lemma, romanization, meaning and the matching words in the translation; OpenAI text-to-speech reads translations aloud.
- **The learner model:** a per-word, per-skill (recognize, script, produce) half-life-regression memory model in its own pure-TypeScript package, with no database or network calls. The **same code** runs on the server, in the client, in the slider replay and in our evaluation, so what you see in the demo is the model itself, not a mock.
- **A key design rule:** the LLM is a sensor and the model is the brain. The language model only annotates messages; it never decides what to hide. That decision belongs to the learner model.
- **Evaluation:** a seeded simulation of 200 learners over eight weeks compares Heirloom's fade policy against a no-fade baseline and a simple counting rule.

We deployed it as a single Render service that serves the API, the sockets and the web app from one HTTPS address.

## Challenges we ran into

- **Making a fading interface trustworthy.** Hiding help too early strands the learner; too late and the app does nothing. Because hints only give weak evidence of knowing a word, our model is deliberately strict about what counts as mastered (strong recall, stable over at least a week, shown on at least two different days).
- **Word-to-word mapping.** Models are unreliable at character offsets. So the model returns the words and our server computes every position itself, then validates that the annotated words rejoin into the exact original text.
- **Messy voice transcripts.** A garbled Whisper transcript once made the model leave out a single word, and our validator rejected the whole message. We changed it to keep skipped words as plain text and reject an analysis only when a large share of the message is skipped.
- **Urdu.** Right-to-left text with nested tappable words, Nastaliq line heights, and romanization that must never sit inside the wrong text direction.
- **Being realistic.** Our first seeded learner reached fluency in eight weeks. That is not believable, so we reset the story to a Listener who becomes a Reader by week eight.
- **iPhone Safari.** Recording, audio playback and touch behavior all had to be designed for a real phone browser.

## Accomplishments that we're proud of

- **A working end-to-end product, live on a public HTTPS link you can open on a phone:** live two-way messaging in English, Spanish and Urdu, voice notes with word-by-word highlighting, and a learning layer you can actually feel.
- **A single model behind everything.** The interface, the slider and the evaluation all run the same learner package, so the demo is honest.
- **An honest evaluation.** In our simulation of 200 learners, Heirloom's fade policy learned about the same number of words as a simple counting rule (37.6 versus 37.7 of 120) and more than no fade at all (34.0). The real difference was in the decision to stop helping: Heirloom removed a hint the learner could not yet recall 10 times out of 17,529 decisions, versus 1,101 out of 21,426 for the counting rule. We did not tune the simulation until we won; we reported the tie and added a measure that shows what actually separates the two.
- **The other person's chat stays simple.** A grandparent sees a normal conversation, and gets to feel the learner reaching back in their language.

## What we learned

- Learning signals should never get in the way of talking. Everything in the learning layer is optional, and curiosity (tapping a word) is never penalized.
- Structured outputs, validated by code, make an LLM a dependable part of a system, as long as the code owns the parts that must be exact.
- A model you can replay is easy to trust. The time-travel slider turned an abstract memory model into something a person can watch.
- Reporting a result we did not expect (a tie) was more convincing than a tuned win.
- Testing on a real phone early matters more than any amount of desktop polish.

## What's next for Heirloom

- **A native-speaker review** of the Spanish and Urdu annotations. The seeded demo history is simulated and the hero messages have not yet been checked by a native speaker.
- **Real learners.** Fit the model's constants to real usage instead of our hand-set values, and run a study with heritage speakers.
- **Practice.** A short, optional daily quiz that updates the word lists, plus word audio in the lists.
- **More languages** (Hindi is already in the stack), and group chats.
- **A layer, not an app:** Heirloom is designed to slot into an existing translated messenger, so people who already talk across a language gap can start learning without switching apps.
