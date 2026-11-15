import type { DayFact, MoonBadgeId, MoonEventId } from '../../game/moon';
import type { L } from '../text';

type P = { tr: string; en: string };
const def = <T extends Record<string, P>>(x: T) => x;

export const M = def({
  cargoPrompt: { tr: 'Komutan, iniş aracı sadece iki ek yük taşıyabilir. Hangilerini alalım?', en: 'Commander, the lander can carry only two extra loads. Which ones do we take?' },
  cargoNext: { tr: 'Yerleştirmeye geç', en: 'Go to building' },
  extraTower: { tr: 'Ek güneş kulesi', en: 'Extra solar tower' },
  batteryBank: { tr: 'Pil bankası', en: 'Battery bank' },
  greenhouse: { tr: 'Sera', en: 'Greenhouse' },
  cargoPick2: { tr: 'İki tane seç', en: 'Pick two' },
  placeHabitat: { tr: 'Önce yaşam modülünü yerleştir. Buza yakın mı, güneşli mi?', en: 'Place the habitat first. Near ice, or sunny?' },
  placeTower: { tr: 'Şimdi güneş kuleleri. Güneşi bol yerler!', en: 'Now the solar towers. Find sunny spots!' },
  placeGreenhouse: { tr: 'Seranı da yerleştir.', en: 'Place your greenhouse too.' },
  placeBattery: { tr: 'Pil ünitesini de yerleştir.', en: 'Place the battery unit too.' },
  placeReady: { tr: 'Hepsi hazır! Görevi başlatalım mı?', en: 'All set! Shall we start the mission?' },
  startMission: { tr: 'Görevi başlat', en: 'Start mission' },
  iceAway: { tr: 'buza', en: 'to ice' },
  coldLate: { tr: 'Görevin sonunda burası karanlık!', en: 'Dark late in the mission!' },
  towersLeft: { tr: 'kule', en: 'towers' },
  morning: { tr: 'Günaydın Komutan!', en: 'Good morning, Commander!' },
  calm: { tr: 'Gökyüzü sakin.', en: 'The sky is calm.' },
  storm: { tr: 'Güneş fırtınası var!', en: 'A solar storm!' },
  super: { tr: 'Çok büyük fırtına!', en: 'A super storm!' },
  planHintPick: { tr: 'Haritada seç', en: 'Pick on map' },
  pickPrompt: { tr: 'Haritada bir yere dokun', en: 'Tap a spot on the map' },
  pickTooFar: { tr: 'Çok uzak: daha yakın bir yere dokun.', en: 'Too far: tap a closer spot.' },
  pickNotIce: { tr: 'Burada buz yok: koyu gölgeli bir yere dokun.', en: 'No ice here: tap a dark shadowed spot.' },
  pickSteep: { tr: 'Çok dik: başka bir yere dokun.', en: 'Too steep: tap another spot.' },
  pickIce: { tr: 'Buzlu bir kratere dokun.', en: 'Tap a shadowed crater.' },
  pickWalk: { tr: 'Yürüyüş için bir yere dokun.', en: 'Tap a spot to walk to.' },
  pickResult: { tr: '{d}: {n} enerji', en: '{d}: {n} energy' },
  pickCancel: { tr: 'Vazgeç', en: 'Cancel' },
  pickNoEnergy: { tr: 'Enerji yetmiyor: daha yakın bir yer seç.', en: 'Not enough energy: pick a closer spot.' },
  pickDone: { tr: 'Yer seçildi', en: 'Spot picked' },
  noEnergy: { tr: 'Enerji yetmiyor', en: 'Not enough energy' },
  noShield: { tr: 'Kalkansız doz olurdu', en: 'Without a shield the dose would be' },
  shieldMax: { tr: 'Kalkan en üst seviyede', en: 'Shield is at the top level' },
  noWalkToday: { tr: 'Bugün yürüyüş yok', en: 'No walk today' },
  noIce: { tr: 'Yakında buz yok', en: 'No ice nearby' },
  noGreenhouse: { tr: 'Sera yok', en: 'No greenhouse' },
  tabBrief: { tr: 'Brifing', en: 'Briefing' },
  tabPlan: { tr: 'Plan', en: 'Plan' },
  tabReport: { tr: 'Rapor', en: 'Report' },
  checklist: { tr: 'Görev listesi', en: 'Mission checklist' },
  listOpen: { tr: 'Listeyi büyüt', en: 'Expand the list' },
  listClose: { tr: 'Listeyi küçült', en: 'Shrink the list' },
  dayN: { tr: 'Gün {n}', en: 'Day {n}' },
  energyToday: { tr: 'Güneşten bugün', en: 'Sun energy today' },
  energyLeft: { tr: 'Kalan enerji', en: 'Energy left' },
  gaugeBattery: { tr: 'Pil', en: 'Battery' },
  gaugeAir: { tr: 'Yaşam desteği', en: 'Life support' },
  gaugeDose: { tr: 'Radyasyon dozu', en: 'Radiation dose' },
  gaugeStars: { tr: 'Bilim yıldızı', en: 'Science stars' },
  gives: { tr: 'Kazandırır', en: 'Gives' },
  cost: { tr: 'Enerji bedeli', en: 'Energy cost' },
  compass: { tr: 'Kamera', en: 'Camera' },
  guideSkip: { tr: 'Ben biliyorum', en: 'I know this' },
  guideNext: { tr: 'Sonraki', en: 'Next' },
  guideDone: { tr: 'Tamam', en: 'Got it' },
  guide1: { tr: 'Bunlar senin göstergelerin: pil, hava, doz ve yıldız.', en: 'These are your gauges: battery, air, dose and stars.' },
  guide2: { tr: 'Bugünün Güneşi burada. Günü planla düğmesine bas.', en: 'Here is today\'s Sun. Press Plan the day.' },
  guide3: { tr: 'Üssü çalıştır eylemini seç, hava bitmesin.', en: 'Pick Keep base running so the air lasts.' },
  guide4: { tr: 'Şimdi Kalkan katmanını seç, dozu düşürür.', en: 'Now pick Shield layer, it lowers your dose.' },
  guide5: { tr: 'Hazırsın! Günü başlat düğmesine bas.', en: 'Ready! Press Start the day.' },
  guide6: { tr: 'Gün bitti. Raporu oku: ne harcadın, ne kazandın?', en: 'The day is done. Read the report: what did you spend and gain?' },  alarmExpected: { tr: 'Bugün alarm gelebilir.', en: 'An alarm may come today.' },
  alertOngoing: { tr: 'Fırtına sürüyor: dışarısı tehlikeli!', en: 'The storm goes on: outside is dangerous!' },
  planTitle: { tr: 'Enerjini harca', en: 'Spend your energy' },
  plan: { tr: 'Günü planla', en: 'Plan the day' },
  go: { tr: 'Günü başlat', en: 'Start the day' },
  keepRunning: { tr: 'Üssü çalıştır', en: 'Keep base running' },
  iceTrip: { tr: 'Buz seferi', en: 'Ice trip' },
  shield: { tr: 'Kalkan katmanı', en: 'Shield layer' },
  walkRim: { tr: 'Kenar yürüyüşü', en: 'Rim walk' },
  walkIce: { tr: 'Buz yürüyüşü', en: 'Ice walk' },
  // ---- exploration (outing before the day) ----
  welcomeCard: { tr: 'Merhaba Komutan! Ben Pati. Ay\'ın güney kutbunu birlikte keşfedelim.', en: 'Hi Commander! I\'m Pati. Let\'s explore the Moon\'s south pole together.' },
  welcomeGo: { tr: 'Keşfe başla', en: 'Start exploring' },
  exploreRow: { tr: 'Keşfe çık', en: 'Go exploring' },
  exploreLocked: { tr: 'Fırtına var: dışarı çıkmak tehlikeli', en: 'Storm outside: it is dangerous to go out' },
  exploreAmount: { tr: 'Keşif enerjisi', en: 'Outing energy' },
  exploreTrimmed: { tr: 'Enerji yetmedi, keşif kısaldı.', en: 'Energy ran short, so the outing shrank.' },
  goHome: { tr: 'Üsse dön', en: 'Go home' },
  missionsTitle: { tr: 'Bugünün görevleri', en: 'Today\'s missions' },
  missionDone: { tr: 'tamam', en: 'done' },
  discoverNew: { tr: 'Yeni yer bulundu!', en: 'New place found!' },
  sourceLabel: { tr: 'Kaynak', en: 'Source' },
  discoverOk: { tr: 'Tamam', en: 'Got it' },
  album: { tr: 'Albüm', en: 'Album' },
  albumPlaces: { tr: 'Keşfettiğin yerler', en: 'Places you found' },
  albumBadges: { tr: 'Rozetlerin', en: 'Your badges' },
  albumUnknown: { tr: 'Henüz bulunmadı', en: 'Not found yet' },
  albumNoBadge: { tr: 'Henüz rozet yok. Keşfe çık!', en: 'No badges yet. Go exploring!' },
  patiExploreStart: { tr: 'Hadi çıkalım Komutan! Enerjin bitmeden dön.', en: 'Let\'s go, Commander! Come back before your energy runs out.' },
  patiBudgetSpent: { tr: 'Enerji bitti, üsse dönüyoruz.', en: 'Energy is spent, so we head home.' },
  // one persistent next-step line in Pati's bubble
  nextPlan: { tr: 'Günü planla düğmesine bas.', en: 'Press Plan the day.' },
  nextPickAction: { tr: 'Bir eylem seç. Enerji bitince eylemler kilitlenir.', en: 'Pick an action. Actions lock when energy runs out.' },
  nextLowBattery: { tr: 'Pil az: önce üssü çalıştır.', en: 'Battery is low: run the base first.' },
  nextGo: { tr: 'Hazırsan Günü başlat düğmesine bas.', en: 'When ready, press Start the day.' },
  nextFlag: { tr: 'Haritada parlayan bayrağa dokun.', en: 'Tap the glowing flag on the map.' },
  nextMoreFlag: { tr: 'Başka bir bayrak bul ya da üsse dön.', en: 'Find another flag, or go home.' },
  nextHome: { tr: 'Enerji azaldı: Üsse dön düğmesine bas.', en: 'Energy is low: press Go home.' },
  nextReport: { tr: 'Raporu oku, sonra devam et.', en: 'Read the report, then continue.' },
  statLit: { tr: 'Bugün güneşte', en: 'Sunlit today' },
  statBerm: { tr: 'Siper seviyesi', en: 'Shield level' },
  statEnergy: { tr: 'Bugün ürettiği enerji', en: 'Energy made today' },
  statGrow: { tr: 'Büyütme ışıkları', en: 'Grow lights' },
  lightsOn: { tr: 'açık, ekstra enerji', en: 'on, extra energy' },
  statBattery:{ tr: 'Pil dolu', en: 'Battery full' },
  sourceBy: { tr: 'Kaynak', en: 'Source' },
  exploreDatasets: { tr: 'Keşif haritası veri kümeleri', en: 'Exploration map datasets' },
  alarm: { tr: 'Alarm! Ekibi geri çağır', en: 'Alarm! Recall the crew' },
  recall: { tr: 'Geri çağır!', en: 'Recall!' },
  reportTitle: { tr: 'Gün bitti', en: 'Day complete' },
  nextDay: { tr: 'Sonraki gün', en: 'Next day' },
  seeEnd: { tr: 'Sonucu gör', en: 'See results' },
  notebook: { tr: 'Defter', en: 'Notebook' },
  archive: { tr: 'Arşiv: Mayıs 2024 (canlı değil)', en: 'Archive: May 2024 (not live)' },
  inside: { tr: 'içeride', en: 'inside' },
  outsideFull: { tr: 'dışarıda', en: 'outside' },
  outsideRecalled: { tr: 'dışarıda, zamanında döndü', en: 'outside, back in time' },
  endTitle: { tr: 'Gerçekte ne oldu?', en: 'What really happened?' },
  endDone: { tr: 'Görev tamamlandı!', en: 'Mission complete!' },
  endEarly: { tr: 'Ekip dinlenmek için erken döndü.', en: 'The crew flew home early to rest.' },
  stormElsewhere: { tr: 'Aynı fırtına başka yerlerde (normal güne göre kat)', en: 'The same storm elsewhere (times a quiet day)' },
  doseNow: { tr: 'Senin dozun', en: 'Your dose' },
  lesson: { tr: 'Güneş varken hazırlan: enerjiyi biriktir, kalkanı kur. Her seçimin bir bedeli var.', en: 'Prepare while the Sun is up: store energy, build your shield. Every choice has a cost.' },
  tryAgain: { tr: 'Tekrar dene', en: 'Try again' },
  sources: { tr: 'Kaynaklar', en: 'Sources' },
  close: { tr: 'Kapat', en: 'Close' },
  sunStory: { tr: 'Güneş {date} sonrasında ufkun altına indi.', en: 'After {date} the Sun sank below the horizon.' },
  sunStoryNone: { tr: 'Bu bölgede Güneş ufka çok yakın dolanır.', en: 'Here the Sun circles very close to the horizon.' },
  assumption: { tr: 'varsayım', en: 'assumption' },
  measured: { tr: 'ölçüm', en: 'measured' },
  rulesTitle: { tr: 'Oyun kuralları: kaynak ve varsayımlar', en: 'Game rules: sources and assumptions' },
  dataTitle: { tr: 'Veri kaynakları', en: 'Data sources' },
  ratioWord: { tr: 'normal günün katı', en: 'times a quiet day' },
  patiBriefCalm: { tr: 'Komutan, sakin bir gün. Enerjini akıllıca kullan!', en: 'Commander, a calm day. Spend your energy wisely!' },
  patiBriefStorm: { tr: 'Komutan, güneş fırtınası! İçeride kal ya da kalkan kur!', en: 'Commander, a solar storm! Stay inside or build a shield!' },
  patiBriefSuper: { tr: 'Komutan, dev bir fırtına! Kalkan şart!', en: 'Commander, a giant storm! A shield is a must!' },
  patiBriefAlert: { tr: 'Komutan, uyarı olabilir! Dışarı çıkarken dikkat!', en: 'Commander, an alert may come! Careful outside!' },
  patiBriefDark: { tr: 'Bugün Güneş ufkun altında, kuleler enerji üretmiyor. Bataryaya dikkat!', en: 'The Sun is below the horizon today, so the towers make no power. Watch the battery!' },
  patiBriefEmpty: { tr: 'Batarya boş! Enerjiyi çok dikkatli harca.', en: 'The battery is empty! Spend energy very carefully.' },
  patiBriefLife: { tr: 'Yaşam desteği azaldı! Buz ya da sera lazım.', en: 'Life support is low! We need ice or the greenhouse.' },
  patiPlanError: { tr: 'Plan çalışmadı. Eylemleri yeniden seç.', en: 'The plan did not run. Pick your actions again.' },
  trimmed: { tr: 'Enerji yetmedi, plan kısaldı. Başka bir eylem seç.', en: 'Energy ran short, so the plan shrank. Pick another action.' },
  patiMode: { tr: 'Hangi göreve çıkıyoruz, Komutan?', en: 'Which mission are we flying, Commander?' },
  modeArchive: { tr: 'Mayıs 2024 Fırtınası', en: 'May 2024 Storm' },
  modeLive: { tr: 'Bugünün Ay\'ı', en: 'Today\'s Moon' },
  badgeArchive: { tr: 'Arşiv', en: 'Archive' },
  badgeLive: { tr: 'Canlı', en: 'Live' },
  lastUpdate: { tr: 'son güncelleme', en: 'last update' },
  offline: { tr: 'çevrimdışı: canlı veri yok', en: 'offline: no live data' },
  liveComputing: { tr: 'Bugünün Güneşi hesaplanıyor…', en: 'Working out today\'s Sun…' },
  patiLive: { tr: 'Komutan, bu bugünün gerçek Güneşi ve gerçek uzay havası!', en: 'Commander, this is the real Sun and real space weather of today!' },
  liveEndTitle: { tr: 'Bugün Ay\'da ne oldu?', en: 'What happened on the Moon today?' },
  liveSunUp: { tr: 'Güneş bugün ufkun en fazla {el}° üstüne çıktı.', en: 'Today the Sun rose at most {el}° above the horizon.' },
  liveSunDown: { tr: 'Güneş bugün hep ufkun altındaydı (merkez noktada).', en: 'Today the Sun stayed below the horizon (at the site centre).' },
  liveTower: { tr: 'kule bugün güneşte', en: 'tower in sunlight today' },
  liveCalm: { tr: 'Son 24 saatte güneş parçacığı olayı yok: sakin bir gün.', en: 'No solar particle event in the last 24 hours: a calm day.' },
  liveStorm: { tr: 'Son 24 saatte güneş parçacığı olayı oldu: fırtına günü (dozun gerçek oranı bilinmiyor, varsayım).', en: 'A solar particle event in the last 24 hours: a storm day (real dose ratio unknown, assumption).' },
  liveNoData: { tr: 'Canlı veri yok: bugünün uzay havasını gösteremiyoruz.', en: 'No live data: we cannot show today\'s space weather.' },
  liveAgain: { tr: 'Yarın Güneş farklı bir yerde olacak, tekrar gel!', en: 'Tomorrow the Sun will be somewhere else. Come back!' },
  liveCme: { tr: 'Dünya yönlü en yeni CME (ENLIL varış tahmini)', en: 'Newest Earth-directed CME (ENLIL arrival)' },
  liveNoCme: { tr: 'Penceredeki CME\'lerin hiçbirinde Dünya için ENLIL varış zamanı yok.', en: 'No CME in the window has an ENLIL arrival time for Earth.' },
  liveNotif: { tr: 'En yeni NOAA/DONKI bildirimi', en: 'Newest NOAA/DONKI notification' },
  liveFetched: { tr: 'Veri alındı', en: 'Fetched' },
  liveNote: { tr: 'Güneş konumu bugün için hesaplandı; kulelerin gölgesi sadece bu 18 km\'lik haritadan hesaplandı.', en: 'The Sun position is computed for today; tower shadows use only this 18 km map.' },
  toArchive: { tr: 'Mayıs 2024 görevi', en: 'May 2024 mission' },
  toLive: { tr: 'Bugünün Ay\'ı', en: 'Today\'s Moon' },
  sunStoryTowers: { tr: 'Kulelerin güneşi {date} günü bitti.', en: 'The towers\' sunlight ran out on {date}.' },
  craterNote: { tr: 'Veri: CRaTER (RadLab). Bu pencerede 16 Mayıs sonrası için DONKI alarm verisi yok.', en: 'Data: CRaTER (RadLab). There is no DONKI alarm data after 16 May in our window.' },
  patiAlarm: { tr: 'Alarm! Ekibi hemen geri çağır!', en: 'Alarm! Recall the crew right now!' },
  patiRecalled: { tr: 'Aferin Komutan! Zamanında döndüler.', en: 'Well done, Commander! They made it back in time.' },
  patiTooLate: { tr: 'Çok geç kaldık...', en: 'We were too late...' },
  patiEnd: { tr: 'Görev bitti! Bak, gerçekte ne olmuş.', en: 'Mission over! Look at what really happened.' },
  // ---- exploration-first world flow ----
  wWelcome: { tr: 'Komutan, Ay\'ın güney kutbuna hoş geldin! Hadi birlikte yürüyelim.', en: 'Commander, welcome to the Moon\'s south pole! Let\'s walk together.' },
  wGoalDone: { tr: 'Görev tamam! Harikasın Komutan.', en: 'Mission done! Great job, Commander.' },
  wMorning: { tr: 'Günaydın Komutan! Yeni bir gün başladı.', en: 'Good morning, Commander! A new day begins.' },
  wAlertMorning: { tr: 'Dışarısı bugün tehlikeli. Uzağa gitme!', en: 'It is dangerous outside today. Do not go far!' },
  wStormMorning: { tr: 'Bugün uzay havası hareketli. Gözünü açık tut!', en: 'Space weather is lively today. Keep your eyes open!' },
  wIce: { tr: 'Buz bulduk! Su ve hava için harika.', en: 'We found ice! Great for water and air.' },
  wBuilt: { tr: 'Kule hazır! Yarın enerji yapmaya başlar.', en: 'The tower is ready! It makes energy from tomorrow.' },
  wBuiltBattery: { tr: 'Pil hazır! Artık daha çok enerji saklarız.', en: 'The battery is ready! We can store more energy.' },
  wBuiltGreenhouse: { tr: 'Sera hazır! Bitkiler hava yapar.', en: 'The greenhouse is ready! Plants make air.' },
  wBuildPrompt: { tr: 'Altın parlayan yerlere dokun. Ne kadar güneşli, o kadar enerji!', en: 'Tap a golden spot. More sun means more energy!' },
  wFactCalm: { tr: 'Bugün uzay radyasyonu sakin bir güne göre {r} kat.', en: 'Today space radiation was {r} times a quiet day.' },
  wFactStorm: { tr: 'Güneş fırtınası radyasyonu {r} katına çıkardı!', en: 'The solar storm made radiation {r} times higher!' },
  wShieldBuilt: { tr: 'Kalkan hazır! Işınımı azaltır.', en: 'The shield is ready! It cuts radiation.' },
  wGreenOn: { tr: 'Sera ışıkları açıldı!', en: 'Greenhouse lights are on!' },
  wStorm: { tr: 'Fırtına! Hemen üsse koş!', en: 'Storm! Run back to base now!' },
  wSafe: { tr: 'Aferin! Zamanında döndük.', en: 'Well done! We made it back in time.' },
  wSafeInside: { tr: 'Fırtına geldi ama üssün içindeyiz, güvendeyiz.', en: 'The storm came, but we are safe inside the base.' },
  wLate: { tr: 'Biraz geç kaldık ama yetiştik.', en: 'We were a bit late, but we made it.' },
  wLowEnergy: { tr: 'Enerji azalıyor. Üsse dönelim mi?', en: 'Energy is getting low. Shall we go home?' },
  wNoEnergy: { tr: 'Enerji bitti. Üsse dönelim.', en: 'Out of energy. Let\'s go home.' },
  wDayDone: { tr: 'Gün bitti! Bak, neler oldu.', en: 'Day over! Look what happened.' },
  btnBuildTower: { tr: 'Kule kur', en: 'Build a tower' },
  btnBuildBattery: { tr: 'Pil kur', en: 'Build a battery' },
  btnBuildGreenhouse: { tr: 'Sera kur', en: 'Build a greenhouse' },
  btnShield: { tr: 'Kalkanı güçlendir', en: 'Strengthen the shield' },
  btnHome: { tr: 'Üsse dön', en: 'Go home' },
  btnHomeDanger: { tr: 'Tehlike! Üsse dön', en: 'Danger! Go home' },
  btnRunHome: { tr: 'Üsse koş', en: 'Run home' },
  btnEndDay: { tr: 'Günü bitir', en: 'End the day' },
  btnCancel: { tr: 'Vazgeç', en: 'Cancel' },
  btnGreenOn: { tr: 'Sera ışığı', en: 'Greenhouse light' },
  needEnergy: { tr: 'Enerji yetmiyor', en: 'Not enough energy' },
  atBaseOnly: { tr: 'Üste yapılır', en: 'Done at base' },
  menu: { tr: 'Menü', en: 'Menu' },
  menuTitle: { tr: 'Menü', en: 'Menu' },
  rotateL: { tr: 'Sola döndür', en: 'Rotate left' },
  rotateR: { tr: 'Sağa döndür', en: 'Rotate right' },
  stormBanner: { tr: 'Fırtına!', en: 'Storm!' },
  repAir: { tr: 'Hava', en: 'Air' },
  repEnergy: { tr: 'Enerji', en: 'Energy' },
  repDose: { tr: 'Işınım', en: 'Radiation' },
  repSun: { tr: 'Güneşten', en: 'From the Sun' },
  repUsed: { tr: 'Harcadığın', en: 'You used' },
  repOutside: { tr: 'dışarıdaydın', en: 'you were outside' },
  repInside: { tr: 'içerideydin', en: 'you were inside' },
  repBack: { tr: 'zamanında döndün', en: 'back in time' },
  goalProgress: { tr: 'Görev', en: 'Mission' },
  bonusStar: { tr: 'yıldız', en: 'star' },
} as const);

export type MKey = keyof typeof M;
export const mt = (k: MKey, l: L): string => M[k][l];

export const EVENT_TEXT: Record<MoonEventId, P> = {
  alarm: { tr: 'Alarm geldi', en: 'Alarm' },
  alertOngoing: { tr: 'Fırtına sürüyor', en: 'Storm ongoing' },
  unannouncedStorm: { tr: 'Habersiz fırtına', en: 'Surprise storm' },
  resupply: { tr: 'Dünya ikmal yolladı', en: 'Earth sent supplies' },
  walkCancelled: { tr: 'Yürüyüş iptal', en: 'Walk cancelled' },
  batteryFull: { tr: 'Pil doldu, enerji boşa gitti', en: 'Battery full, energy wasted' },
  darkDay: { tr: 'Karanlık gün', en: 'Dark day' },
  earlyReturn: { tr: 'Erken dönüş', en: 'Early return' },
};

export const BADGE_TEXT: Record<MoonBadgeId, P> = {
  sunHunter: { tr: 'Güneş avcısı', en: 'Sun hunter' },
  iceMiner: { tr: 'Buz madencisi', en: 'Ice miner' },
  safeHarbor: { tr: 'Güvenli liman', en: 'Safe harbor' },
  scientist: { tr: 'Bilim insanı', en: 'Scientist' },
};

/** Tapped-building card: name + one line of what it does, in kid words. */
export const BUILDING_TEXT: Record<string, { name: P; what: P }> = {
  habitat: { name: { tr: 'Yaşam modülü', en: 'Habitat' }, what: { tr: 'Evimiz: nefes alacak hava ve uyuyacak yer var.', en: 'Our home: air to breathe and a place to sleep.' } },
  solarTower: { name: { tr: 'Güneş kulesi', en: 'Solar tower' }, what: { tr: 'Güneş ışığını elektriğe çevirir.', en: 'Turns sunlight into electricity.' } },
  batteryUnit: { name: { tr: 'Pil ünitesi', en: 'Battery unit' }, what: { tr: 'Enerjiyi saklar, Güneş yokken kullanırız.', en: 'Stores energy for when the Sun is away.' } },
  greenhouse: { name: { tr: 'Sera', en: 'Greenhouse' }, what: { tr: 'Bitki yetiştirir: yiyecek ve temiz hava.', en: 'Grows plants for food and fresh air.' } },
  rover: { name: { tr: 'Gezgin', en: 'Rover' }, what: { tr: 'Altı tekerlekli araç: buz ve taş getirmeye gider.', en: 'A six-wheeled car that fetches ice and rocks.' } },
  lander: { name: { tr: 'İniş aracı', en: 'Lander' }, what: { tr: 'Bizi Ay\'a getiren uzay aracı.', en: 'The spaceship that brought us to the Moon.' } },
  antenna: { name: { tr: 'Anten', en: 'Antenna' }, what: { tr: 'Dünya ile konuşmamızı sağlar.', en: 'Lets us talk to Earth.' } },
};

export const PLACE_TEXT: Record<string, P> = {
  lunarOrbit: { tr: 'Ay yörüngesi', en: 'Lunar orbit' },
  deepSpace: { tr: 'Derin uzay', en: 'Deep space' },
  iss: { tr: 'Uluslararası Uzay İstasyonu', en: 'International Space Station' },
  marsSurface: { tr: 'Mars yüzeyi', en: 'Mars surface' },
};

/** Fact lines are English in the engine; Turkish text is built from id + values. */
export const fmt1 = (v: number): number => Math.round(v * 10) / 10;

/** English POI name -> Turkish name; Game fills it once the points of interest are derived (used by the 'explore' fact). */
export const POI_TR = new Map<string, string>();

export function factText(f: DayFact, l: L): string {
  const v = f.values;
  if (f.id === 'radiation' && typeof v.ratio === 'number') {
    return l === 'tr' ? `Uzay havası: doz, sakin bir günün ${fmt1(v.ratio)} katıydı (aynı dedektör).` : `Space weather: dose was ${fmt1(v.ratio)}x a quiet day (same detector).`;
  }
  if (l === 'en') return f.en;
  switch (f.id) {
    case 'towerSun':
      return `${v.tower}. kule bugün günün %${v.litPct} kadarında güneşte.`;
    case 'radiation':
      return v.band === 'calm' ? 'Sakin gün: sadece kozmik ışınlar.' : 'Uzay havası: doz, sakin bir günün bilinmeyen katıydı (aynı dedektör).';
    case 'alarm':
      return `Güneş parçacığı alarmı ${v.alarmAt} zamanında geldi.`;
    case 'iceDistance':
      return `En yakın sürekli gölgeli bölge ${v.distanceM} m uzakta.`;
    case 'explore': {
      const names = typeof v.found === 'string' ? [...POI_TR.entries()].reduce((s, [en, tr]) => s.split(en).join(tr), v.found) : '';
      const km = (Number(v.distanceM ?? 0) / 1000).toLocaleString('tr', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      return names ? `${km} km keşfettin, buldun: ${names}.` : `${km} km keşfettin.`;
    }
    case 'berm':
      return `${v.level}. seviye siper dozu ${v.divisor} kat azaltır.`;
    default:
      return f.en;
  }
}
