## Inspiration

Heirloom started with Victor's family.

*"My grandmother came to the U.S. as an immigrant many years ago, with my dad, from Ishigaki, Okinawa. Over time my dad lost touch with her culture. He can't speak her native language, only recall a few familiar words, and there's a real disconnect with a mother who is deeply proud of her Japanese roots.*

*As her grandson, I feel that gap too. I want to be confident enough to practice Japanese with her, and I believe that if I were, I'd feel more connected to a side of myself I wish I could embrace more. She speaks English, so we can talk. But a translator would never help me actually join her language.*

*And it isn't only families. Friends and colleagues across a language gap want the same thing, in a setting that feels convenient and empowering."*

Translation apps solve the message and skip the person: you get the meaning, learn nothing, and still need the translate button a year later. We wanted the opposite. A real conversation with someone you care about is the best language course there is. It just needs software that notices what you understand and gradually steps back.

## What it does

Heirloom is a messenger where one person writes in English and the other reads in Spanish or Urdu, and back. Text and voice notes are translated, transcribed and read aloud. For the other person it is just a normal chat.

For the learner, turning Heirloom on adds a learning layer:

- **Tap any word** for its meaning, grammar and cultural context. The matching word lights up in the translation, in both left-to-right and right-to-left (Urdu) text.
- **Everything you do teaches the model:** reading without help, tapping, answering a quick guess, replaying a voice note.
- **The translation fades with you.** Listener, Reader, Conversant, Fluent: each stage shows a little less help, and a word's hint dissolves once you truly know it.
- **A Progress tab** shows Mastered, Learning and New words, and a **time-travel slider** replays eight weeks through the real model so you can watch the fade happen.

## How we built it

- **App:** Expo / React Native for web, running on an iPhone in Safari, backed by Node, Express and Socket.IO for live updates, and Supabase for chats, voice notes and learning data.
- **AI pipeline:** Whisper transcribes voice notes, GPT-4o-mini translates and breaks each message into words (meaning, romanization, matching translation words), and OpenAI text-to-speech reads translations aloud.
- **The learner model:** a per-word, per-skill half-life-regression memory model in a pure TypeScript package. The same code powers the server, the app, the slider and our evaluation, so the demo is the model itself.
- **A design rule we held to:** the language model only annotates; the learner model decides what to hide.

## Challenges we ran into

- **Trusting a fade.** Removing help too early strands the learner. So "mastered" is strict: strong recall, stable for a week, shown on two different days.
- **Exact word mapping.** Language models drift on character positions, so our server computes them itself and checks that the annotated words rebuild the original message exactly.
- **Messy voice transcripts,** where a garbled word can break an annotation. We now keep skipped words as plain text instead of throwing the whole message away.
- **Urdu:** right-to-left text with tappable words and Nastaliq script.
- **Realism.** Our first simulated learner reached fluency in eight weeks. We reset the story to a Listener becoming a Reader.

## Accomplishments that we're proud of

- **A working product on a public link** you can open on a phone: live two-way chat in English, Spanish and Urdu, voice notes, and a learning layer you can feel.
- **One model behind everything,** so what you see is honest.
- **An honest evaluation.** In a simulation of 200 learners, Heirloom learned about as many words as a simple counting rule (37.6 vs 37.7 of 120) and more than no fade (34.0). The real gap is in when to stop helping: Heirloom removed a hint a learner couldn't yet recall 10 times in 17,529 decisions, the counting rule 1,101 times in 21,426. We reported the tie rather than tune the simulation to win.
- **The other person's chat stays simple,** and they get to see someone reaching toward their language.

## What we learned

- Learning should never get in the way of talking. Everything is optional, and curiosity is never penalized.
- A language model is dependable when it produces structured output and our code owns everything that must be exact.
- A model you can replay is one people trust. The slider made an abstract memory model something you can watch.

## What's next for Heirloom

- **Japanese,** the language that started this. It has no spaces between words, so it needs its own word-splitting work first, and a native-speaker check.
- **Native-speaker review** of our Spanish and Urdu annotations. The seeded history in the demo is simulated.
- **Real learners:** fit the model to real usage and run a study with heritage speakers, plus a short daily practice quiz.
- **A layer, not an app:** Heirloom is built to slot into a messenger people already use, so anyone talking across a language gap can start learning without switching apps.
