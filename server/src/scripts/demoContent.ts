// Scripted 8-week demo conversations (PLAN.md §9.1). Everyday vocabulary recurs on purpose so the learner
// model has something to learn. Everything here is simulated and labeled as such in the write-up; the
// non-English lines need a native check (analyses keep needs_native_check = true).
import heroes from './heroMessages.json' with { type: 'json' };

export interface ScriptLine {
  /** 'them' = Abuela / Zara, 'arjun' = the learner. */
  from: 'them' | 'arjun';
  week: number; // 1..8
  text: string;
  voice?: boolean;
  heroId?: string;
}

const hero = (lang: 'es' | 'ur', id: string, week: number, voice = false): ScriptLine => {
  const h = heroes[lang].find((x) => x.id === id);
  if (!h) throw new Error(`Missing hero message ${id}`);
  return { from: 'them', week, text: h.text, voice, heroId: id };
};

/** Arjun ↔ Abuela (Spanish). Includes the short daily check-ins grandparents actually send. */
export const SPANISH: ScriptLine[] = [
  hero('es', 'es-1', 1, true),
  { from: 'arjun', week: 1, text: "Hi Abuela! I miss you too. I'm good, just busy with school." },
  { from: 'them', week: 1, text: '¿Cómo estás, mijo? ¿Comiste bien hoy?' },
  { from: 'arjun', week: 1, text: 'Yes, I made pasta. Not as good as yours!' },
  { from: 'them', week: 1, text: 'Mañana voy al médico por mi rodilla.' },
  { from: 'them', week: 1, text: 'Buenos días, mijo. ¿Dormiste bien?' },
  { from: 'them', week: 1, text: 'Hoy hace frío. Come algo caliente.' },

  { from: 'arjun', week: 2, text: 'Good luck at the doctor, let me know how it goes.' },
  { from: 'them', week: 2, text: 'El médico dice que estoy bien. Solo necesito caminar más.' },
  { from: 'arjun', week: 2, text: 'That is great news! Walk with Tía on Sunday?' },
  { from: 'them', week: 2, text: 'Sí, el domingo caminamos con tu tía. Te quiero mucho, mijo.', voice: true },
  { from: 'them', week: 2, text: 'Aquí hace mucho frío hoy. ¿Y allá?' },
  { from: 'them', week: 2, text: '¿Ya comiste? Hay sopa en mi casa.' },
  { from: 'them', week: 2, text: 'Tu tía te manda un abrazo.' },
  { from: 'them', week: 2, text: 'Buenas noches, mijo. Duerme bien.', voice: true },

  { from: 'them', week: 3, text: '¿Cómo va la escuela? ¿Tienes un examen pronto?' },
  { from: 'arjun', week: 3, text: "I have a big exam next week. I'm studying a lot." },
  { from: 'them', week: 3, text: 'Estudia mucho pero duerme bien, mijo.' },
  { from: 'arjun', week: 3, text: 'I will, I promise.', voice: true },
  { from: 'them', week: 3, text: 'Hoy cociné sopa de pollo. Tu favorita.', voice: true },
  { from: 'them', week: 3, text: 'Buenos días. ¿Cómo dormiste?', voice: true },
  { from: 'them', week: 3, text: 'Hoy hace sol, pero hace frío.' },

  hero('es', 'es-2', 4),
  { from: 'arjun', week: 4, text: "Thanks Abuela. I'm nervous but ready." },
  { from: 'them', week: 4, text: 'Te quiero mucho. Llámame después del examen.' },
  { from: 'arjun', week: 4, text: 'The exam went well!', voice: true },
  { from: 'them', week: 4, text: '¡Qué bien, mijo! Estoy muy orgullosa de ti.', voice: true },
  { from: 'them', week: 4, text: '¿Comiste bien hoy, mijo?' },
  { from: 'them', week: 4, text: 'Buenas noches. Te quiero mucho.', voice: true },

  { from: 'them', week: 5, text: 'Hoy llueve mucho aquí. ¿Allá también hace frío?' },
  { from: 'arjun', week: 5, text: "No rain here, but it's cold." },
  { from: 'them', week: 5, text: 'Ponte un abrigo, mijo. No quiero que te enfermes.', voice: true },
  { from: 'arjun', week: 5, text: "Haha okay, I'm wearing the sweater you made." },
  { from: 'them', week: 5, text: 'Buenos días, mijo. Hoy llueve otra vez.', voice: true },
  { from: 'them', week: 5, text: 'Tu tía y yo comimos sopa hoy.' },
  { from: 'them', week: 5, text: 'Duerme bien, mijo. Mañana hablamos.' },

  { from: 'them', week: 6, text: '¿Vienes a visitar pronto? Tus primos preguntan por ti.' },
  { from: 'arjun', week: 6, text: 'I want to visit in December!' },
  { from: 'them', week: 6, text: '¡Qué feliz estoy! Voy a cocinar tamales para toda la familia.', voice: true },
  { from: 'arjun', week: 6, text: 'Can you teach me how to make your soup?' },
  { from: 'them', week: 6, text: 'Claro que sí. Primero compra pollo y verduras.' },
  { from: 'them', week: 6, text: '¿Cómo va la escuela, mijo?' },
  { from: 'them', week: 6, text: 'Buenas noches. Un abrazo fuerte.', voice: true },

  { from: 'arjun', week: 7, text: 'I made your soup today! It was pretty good.' },
  hero('es', 'es-3', 7, true),
  { from: 'them', week: 7, text: 'Mañana hace frío otra vez. Come sopa y duerme bien.' },
  { from: 'arjun', week: 7, text: 'Will do. How is your knee?' },
  { from: 'them', week: 7, text: 'Buenos días, mijo. ¿Dormiste bien?', voice: true },
  { from: 'them', week: 7, text: 'Hoy hace mucho frío aquí.' },
  { from: 'them', week: 7, text: 'Te quiero mucho. Come bien.' },

  { from: 'them', week: 8, text: 'Mi rodilla está mejor. Camino todos los días con tu tía.', voice: true },
  { from: 'arjun', week: 8, text: "I'm so happy to hear that." },
  { from: 'them', week: 8, text: 'Te quiero mucho, mijo. Hablamos el domingo.' },
  { from: 'arjun', week: 8, text: 'Love you too, Abuela! Talk Sunday.' },
  { from: 'them', week: 8, text: 'Estudia mucho, come bien y duerme bien. Un abrazo fuerte.' },
  { from: 'them', week: 8, text: 'Buenos días, mijo. Hoy hace sol.' },
  { from: 'them', week: 8, text: '¿Comiste bien? Duerme bien hoy.' },
  { from: 'them', week: 8, text: 'Buenas noches, mijo. Te quiero mucho.', voice: true },
];

/** Arjun ↔ Zara (Urdu). */
export const URDU: ScriptLine[] = [
  hero('ur', 'ur-1', 1, true),
  { from: 'arjun', week: 1, text: 'Haha nothing, just tired from class.' },
  { from: 'them', week: 1, text: 'اچھا، آج رات کھانا کھانے چلیں؟' },
  { from: 'arjun', week: 1, text: 'Yes! Where do you want to go?' },
  { from: 'them', week: 1, text: 'بریانی کھانے چلتے ہیں۔ میں سات بجے آؤں گی۔' },

  { from: 'them', week: 2, text: 'یار، آج بہت گرمی ہے۔ چائے پیو گے؟', voice: true },
  { from: 'arjun', week: 2, text: 'Always yes to chai.' },
  { from: 'them', week: 2, text: 'کل ہمارا امتحان ہے۔ کیا تم پڑھ رہے ہو؟' },
  { from: 'arjun', week: 2, text: 'Trying to. Want to study together?', voice: true },
  { from: 'them', week: 2, text: 'ہاں، لائبریری میں ملتے ہیں۔' },

  hero('ur', 'ur-2', 3),
  { from: 'arjun', week: 3, text: 'Same here. Almost done though!' },
  { from: 'them', week: 3, text: 'امتحان ختم! اب فلم دیکھنے چلیں؟', voice: true },
  { from: 'arjun', week: 3, text: 'Which movie?' },
  { from: 'them', week: 3, text: 'کوئی بھی اچھی فلم۔ تم چائے لے آنا۔' },

  { from: 'them', week: 4, text: 'آج بارش ہو رہی ہے۔ موسم بہت اچھا ہے۔' },
  { from: 'arjun', week: 4, text: 'I love this weather.' },
  { from: 'them', week: 4, text: 'بارش میں چائے اور پکوڑے، اس سے اچھا کیا ہے؟', voice: true },
  { from: 'arjun', week: 4, text: 'Nothing beats that.' },

  hero('ur', 'ur-3', 5),
  { from: 'arjun', week: 5, text: 'Perfect plan.', voice: true },
  { from: 'them', week: 5, text: 'میں کل دس بجے تیار ہوں گی۔' },
  { from: 'them', week: 5, text: 'بازار میں بہت مزہ آیا۔ شکریہ یار!', voice: true },
  { from: 'arjun', week: 5, text: 'Thank you for the books!' },

  { from: 'them', week: 6, text: 'تمہاری امی کیسی ہیں؟' },
  { from: 'arjun', week: 6, text: "She's good, she says hi." },
  { from: 'them', week: 6, text: 'ان کو میرا سلام کہنا۔ کل پڑھنے چلیں؟' },
  { from: 'arjun', week: 6, text: 'Yes, library at 3?' },

  { from: 'them', week: 7, text: 'آج بہت گرمی ہے، میں تھک گئی ہوں۔', voice: true },
  { from: 'arjun', week: 7, text: 'Get some rest! Chai later?', voice: true },
  { from: 'them', week: 7, text: 'ہاں، شام کو چائے پیتے ہیں۔' },

  { from: 'them', week: 8, text: 'اگلے ہفتے میری سالگرہ ہے! تم آؤ گے نا؟' },
  { from: 'arjun', week: 8, text: "Of course! I wouldn't miss it." },
  { from: 'them', week: 8, text: 'شکریہ یار، تم بہت اچھے دوست ہو۔', voice: true },
  { from: 'arjun', week: 8, text: 'You too, Zara.' },
  { from: 'them', week: 8, text: 'کل ملتے ہیں۔ خدا حافظ!' },
];
