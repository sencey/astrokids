// All spoken lines. The id doubles as the audio file key: public/audio/voice/{lang}/{id}.mp3
// Every line: second person, warm, simple, ideally <= ~4 s spoken.

export type Lang = 'tr' | 'en';
export interface Line {
  tr: string;
  en: string;
}

export const LINES = {
  // ---- Tutorial (script given by the design brief) ----
  'tut.intro': { tr: 'Hav! Ben Pati. Uzay köpeğiyim!', en: "Woof! I'm Pati. I'm a space dog!" },
  'tut.intro.hint': { tr: 'Bana dokun!', en: 'Tap me!' },
  'tut.frame': {
    tr: "Bak! Belka ve Strelka. Dünya'nın çevresinde döndüler ve sağ salim eve geldiler!",
    en: 'Look! Belka and Strelka. They flew around the Earth and came home safe!',
  },
  'tut.frame.hint': { tr: 'Çerçeveye dokun!', en: 'Tap the picture!' },
  'tut.frame.done': { tr: 'Hav hav! Mutlu son!', en: 'Woof woof! A happy ending!' },
  'tut.panel': {
    tr: "Şimdi sıra bizde. Burası Ay'daki evimiz. Güneş bize enerji topu veriyor. Getireyim mi?",
    en: 'Now it’s our turn. This is our home on the Moon. The Sun gives us energy balls. Shall I fetch?',
  },
  'tut.panel.hint': { tr: 'Güneş paneline dokun!', en: 'Tap the sun panel!' },
  'tut.fetch': { tr: 'Getiriyorum! Hav hav!', en: 'Fetching! Woof woof!' },
  'tut.water': { tr: 'Bir topu su makinesine sürükle.', en: 'Drag a ball to the water machine.' },
  'tut.garden': { tr: 'Şimdi bahçeye.', en: 'Now the garden.' },
  'tut.wall': {
    tr: 'Sonuncusu kulübeme. Duvarı kalın olsun!',
    en: 'The last one goes to my doghouse. Thick walls!',
  },
  'tut.drag.hint': { tr: 'Topu sürükle!', en: 'Drag the ball!' },
  'tut.alarm': {
    tr: 'Dur... tasmam ötüyor! Güneş hapşırdı. Işıltılar geliyor. Çabuk, kulübeye!',
    en: 'Wait... my collar is beeping! The Sun sneezed. Sparkles are coming. Quick, into the doghouse!',
  },
  'tut.alarm.hint': { tr: 'Kulübeye dokun!', en: 'Tap the doghouse!' },
  'tut.end': {
    tr: 'Oh! Kalın duvar bizi korudu. Ama içerideyken bahçeye bakamadık. Her seçimin bir bedeli var. Hazır mısın? Gerçek bir fırtına bizi bekliyor!',
    en: 'Phew! The thick wall kept us safe. But while we hid, nobody cared for the garden. Every choice costs something. Ready? A real storm is waiting for us!',
  },

  // ---- Mode select / map ----
  'mode.pick': { tr: 'Nasıl oynayalım?', en: 'How shall we play?' },
  'mode.pick.hint': { tr: 'Birine dokun!', en: 'Tap one!' },
  'map.pick': { tr: 'Nereye gidelim?', en: 'Where shall we go?' },
  'map.archive': { tr: 'Büyük fırtına! Mayıs 2024.', en: 'The great storm! May 2024.' },
  'map.live': { tr: 'Bugün gökyüzü nasıl?', en: 'How is the sky today?' },

  // ---- Day loop ----
  'day.sniff': { tr: 'Tasmama dokun. Gökyüzüne bakalım!', en: 'Tap my collar. Let’s sniff the sky!' },
  'day.sniff.hint': { tr: 'Tasmama dokun!', en: 'Tap my collar!' },
  'day.sniff.calm': { tr: 'Burun burun... Gökyüzü sakin.', en: 'Sniff sniff... The sky is calm.' },
  'day.sniff.alert': { tr: 'Hmm! Güneşten bir bulut geliyor.', en: 'Hmm! A cloud is coming from the Sun.' },
  'day.sniff.big': { tr: 'Vay! Büyük bir parlama!', en: 'Wow! A big flare!' },
  'day.sniff.small': { tr: 'Küçük bir parlama gördüm.', en: 'I saw a small flare.' },
  'day.sniff.ongoing': { tr: 'Işıltı uyarısı hâlâ sürüyor.', en: 'The sparkle alert is still on.' },
  'day.guess': { tr: 'Bulut ne zaman gelir? Tahmin et!', en: 'When will the cloud arrive? Make a guess!' },
  'day.guess.hint': { tr: 'Işareti kaydır!', en: 'Slide the marker!' },
  'day.distribute': { tr: 'Topları odalara sürükle.', en: 'Drag the balls to the rooms.' },
  'day.distribute.hint': { tr: 'Topu sürükle!', en: 'Drag a ball!' },
  'day.door': { tr: 'Kapıya dokun: ekip içeri ya da dışarı.', en: 'Tap the door: crew in or out.' },
  'day.leftover': { tr: 'Hâlâ topların var!', en: 'You still have balls!' },
  'day.confirm': { tr: 'Hazırsan patime bas!', en: 'Press my paw when ready!' },
  'day.confirm.hint': { tr: 'Pati’nin patisine bas!', en: 'Press the paw!' },
  'day.alarm': { tr: 'Hav hav! Tasmam öttü! Çabuk, kulübeye!', en: 'Woof woof! My collar beeped! Quick, into the doghouse!' },
  'day.alarm.hint': { tr: 'Kulübeye dokun!', en: 'Tap the doghouse!' },
  'day.alarm.ok': { tr: 'Aferin! Hepimiz içerideyiz!', en: 'Well done! We are all inside!' },
  'day.alarm.late': { tr: 'Biraz geç kaldık. Bir dahaki sefere!', en: 'A little late. Next time!' },
  'result.calm': { tr: 'Bugün sakindi.', en: 'It was a calm day.' },
  'result.sheltered': { tr: 'Kalın duvar bizi korudu.', en: 'The thick wall kept us safe.' },
  'result.exposed': { tr: 'Çok ışıltı geldi. Yarın daha hazırlıklı olalım.', en: 'Lots of sparkles. Let’s be readier tomorrow.' },
  'result.sample': { tr: 'Numune çantası doldu!', en: 'The sample bag got fuller!' },
  'result.nosample': { tr: 'Bugün numune alamadık.', en: 'No sample today.' },
  'result.sleepy': { tr: 'Esneme... Hava makinesi susamış.', en: 'Yawn... The air machine is thirsty.' },
  'result.next': { tr: 'Yeni bir gün!', en: 'A new day!' },
  'resupply': { tr: "Dünya'dan bir paket geldi!", en: 'A crate came from Earth!' },
  'early': { tr: 'Kavanoz doldu. Ekip dinlenmeye eve dönüyor.', en: 'The jar is full. The crew goes home to rest.' },

  // ---- Ending ----
  'end.week': { tr: 'İşte senin haftan!', en: 'Here is your week!' },
  'end.reality': { tr: 'Gerçekte ne oldu?', en: 'What really happened?' },
  'end.lesson.captain': {
    tr: 'Fırtınayı durduramayız. Ama tahmine bakıp hazırlanabiliriz; hazırlanmanın da bir bedeli vardır.',
    en: "We can't stop a space storm. But we can read the forecast and get ready, and getting ready always costs something.",
  },
  'end.lesson.playmate': {
    tr: 'Kalın duvar bizi korur. Ama içeride kalınca bahçe bekler.',
    en: 'Thick walls keep us safe. But while we hide, the garden waits.',
  },
  'end.which': { tr: 'Hangi günü değiştirirdin?', en: 'Which day would you change?' },

  // ---- Today's Sky ----
  'sky.calm': { tr: 'Bugün Güneş sakin.', en: 'The Sun is calm today.' },
  'sky.guess': { tr: 'Bulut ne zaman gelir? Tahmin et!', en: 'When will the cloud arrive? Make a guess!' },
  'sky.guess.hint': { tr: 'Bir güne dokun!', en: 'Tap a day!' },
  'sky.later': { tr: 'Yarın birlikte bakalım.', en: "Let's check together tomorrow." },
  'sky.result': { tr: 'İşte gerçekte olan!', en: 'Here is what really happened!' },
  'sky.never': { tr: 'Bulut hiç gelmedi!', en: 'The cloud never came!' },
  'sky.offline': { tr: 'İnternet yok. Son haritaya bakıyoruz.', en: 'No internet. We look at the last map.' },
} as const satisfies Record<string, Line>;

export type LineId = keyof typeof LINES;

export const lineText = (id: LineId, lang: Lang): string => LINES[id][lang];

export const detectLang = (): Lang =>
  typeof navigator !== 'undefined' && (navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en';
