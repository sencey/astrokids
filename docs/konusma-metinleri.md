# Ay Üssü Komutanı — Tüm Konuşma ve Ekran Metinleri

Kaynak dosyalar: `src/ui3d/mission/text.ts`, `src/ui3d/text.ts`, `src/ui3d/pati/PatiAvatar.tsx` (14 Kasım 2026 itibarıyla). Pati'nin sesli söylediği satırlar "Pati" işaretlidir; ses şu an tarayıcının metin okuma özelliğiyle çalınıyor. `{d}`, `{n}`, `{date}`, `{el}` oyunda gerçek değerle doldurulan yerlerdir.

## 1. Açılış ve görev seçimi

| Anahtar | Kim | Türkçe | English |
| --- | --- | --- | --- |
| welcome | Pati | Komutan, Ay'ın güney kutbuna hoş geldin! Üssümüzü nereye kuralım? | Commander, welcome to the Moon's south pole! Where shall we build our base? |
| loading | Ekran | Ay yükleniyor… | Loading the Moon… |
| start | Düğme | Başla | Start |
| skip | Düğme | Geç | Skip |
| patiMode | Pati | Hangi göreve çıkıyoruz, Komutan? | Which mission are we flying, Commander? |
| modeArchive | Kart | Mayıs 2024 Fırtınası | May 2024 Storm |
| modeLive | Kart | Bugünün Ay'ı | Today's Moon |
| badgeArchive | Rozet | Arşiv | Archive |
| badgeLive | Rozet | Canlı | Live |
| lastUpdate | Rozet | son güncelleme | last update |
| offline | Rozet | çevrimdışı: canlı veri yok | offline: no live data |

## 2. Yük seçimi

| Anahtar | Kim | Türkçe | English |
| --- | --- | --- | --- |
| cargoPrompt | Pati | Komutan, iniş aracı sadece iki ek yük taşıyabilir. Hangilerini alalım? | Commander, the lander can carry only two extra loads. Which ones do we take? |
| extraTower | Kart | Ek güneş kulesi | Extra solar tower |
| batteryBank | Kart | Pil bankası | Battery bank |
| greenhouse | Kart | Sera | Greenhouse |
| cargoPick2 | Düğme | İki tane seç | Pick two |
| cargoNext | Düğme | Yerleştirmeye geç | Go to building |

## 3. Üssü kurma (yerleştirme)

| Anahtar | Kim | Türkçe | English |
| --- | --- | --- | --- |
| placeHabitat | Pati | Önce yaşam modülünü yerleştir. Buza yakın mı, güneşli mi? | Place the habitat first. Near ice, or sunny? |
| placeTower | Pati | Şimdi güneş kuleleri. Güneşi bol yerler! | Now the solar towers. Find sunny spots! |
| placeGreenhouse | Pati | Seranı da yerleştir. | Place your greenhouse too. |
| placeReady | Pati | Hepsi hazır! Görevi başlatalım mı? | All set! Shall we start the mission? |
| hintPick | Pati (ipucu) | Yeşil kareye dokun! | Tap a green square! |
| hintConfirm | Pati (ipucu) | Burada kuralım mı? Onayla! | Build here? Confirm! |
| hintSteep | Pati (ipucu) | Burası çok dik! | Too steep here! |
| hintTaken | Pati (ipucu) | Burası dolu! | This spot is taken! |
| shadowForever | Etiket | Hep gölge: buz var! | Always dark: ice! |
| coldLate | Etiket | Görevin sonunda burası karanlık! | Dark late in the mission! |
| iceAway | Etiket | buza (ör. "buza 0,4 km") | to ice |
| steep | Etiket | Dik | Steep |
| today | Etiket | bugün | today |
| towersLeft | Sayaç | kule | towers |
| confirm | Düğme | Kur | Build |
| resetBuild | Düğme | Yerleşimi sıfırla | Reset placement |
| startMission | Düğme | Görevi başlat | Start mission |
| habitat / solarTower / greenhouse / rover / antenna / lander | Bina adları | Yaşam modülü / Güneş kulesi / Sera / Gezgin / Anten / İniş aracı | Habitat / Solar tower / Greenhouse / Rover / Antenna / Lander |

## 4. Rehberli ilk gün (yalnızca ilk görevde)

| Adım | Türkçe | English |
| --- | --- | --- |
| guide1 | Bunlar senin göstergelerin: pil, hava, doz ve yıldız. | These are your gauges: battery, air, dose and stars. |
| guide2 | Bugünün Güneşi burada. Günü planla düğmesine bas. | Here is today's Sun. Press Plan the day. |
| guide3 | Üssü çalıştır eylemini seç, hava bitmesin. | Pick Keep base running so the air lasts. |
| guide4 | Şimdi Kalkan katmanını seç, dozu düşürür. | Now pick Shield layer, it lowers your dose. |
| guide5 | Hazırsın! Günü başlat düğmesine bas. | Ready! Press Start the day. |
| guide6 | Gün bitti. Raporu oku: ne harcadın, ne kazandın? | The day is done. Read the report: what did you spend and gain? |
| guideNext / guideSkip / guideDone | Sonraki / Ben biliyorum / Tamam | Next / I know this / Got it |

## 5. Sabah brifingi (Pati önceliğe göre tek cümle seçer)

| Anahtar | Ne zaman | Türkçe | English |
| --- | --- | --- | --- |
| patiBriefSuper | Süper fırtına | Komutan, dev bir fırtına! Kalkan şart! | Commander, a giant storm! A shield is a must! |
| patiBriefStorm | Fırtına | Komutan, güneş fırtınası! İçeride kal ya da kalkan kur! | Commander, a solar storm! Stay inside or build a shield! |
| patiBriefAlert | Alarm bekleniyor | Komutan, uyarı olabilir! Dışarı çıkarken dikkat! | Commander, an alert may come! Careful outside! |
| patiBriefDark | Güneş yok | Bugün Güneş ufkun altında, kuleler enerji üretmiyor. Bataryaya dikkat! | The Sun is below the horizon today, so the towers make no power. Watch the battery! |
| patiBriefEmpty | Batarya boş | Batarya boş! Enerjiyi çok dikkatli harca. | The battery is empty! Spend energy very carefully. |
| patiBriefLife | Yaşam desteği az | Yaşam desteği azaldı! Buz ya da sera lazım. | Life support is low! We need ice or the greenhouse. |
| patiBriefCalm | Sakin gün | Komutan, sakin bir gün. Enerjini akıllıca kullan! | Commander, a calm day. Spend your energy wisely! |
| morning | Başlık | Günaydın Komutan! | Good morning, Commander! |
| calm / storm / super | Hava satırı | Gökyüzü sakin. / Güneş fırtınası var! / Çok büyük fırtına! | The sky is calm. / A solar storm! / A super storm! |
| alarmExpected | Uyarı | Bugün alarm gelebilir. | An alarm may come today. |
| alertOngoing | Uyarı | Fırtına sürüyor: dışarısı tehlikeli! | The storm goes on: outside is dangerous! |
| energyToday | Etiket | Güneşten bugün | Sun energy today |
| dayN | Başlık | Gün {n} | Day {n} |
| plan | Düğme | Günü planla | Plan the day |

## 6. Plan sayfası (enerjiyi harcama)

| Anahtar | Kim | Türkçe | English |
| --- | --- | --- | --- |
| planTitle | Başlık | Enerjini harca | Spend your energy |
| energyLeft | Etiket | Kalan enerji | Energy left |
| keepRunning | Eylem | Üssü çalıştır | Keep base running |
| iceTrip | Eylem | Buz seferi | Ice trip |
| greenhouse | Eylem | Sera | Greenhouse |
| shield | Eylem | Kalkan katmanı | Shield layer |
| walkRim | Eylem | Kenar yürüyüşü | Rim walk |
| walkIce | Eylem | Buz yürüyüşü | Ice walk |
| gives / cost | Etiket | Kazandırır / Enerji bedeli | Gives / Energy cost |
| planHint | Pati | Bir eylem seç. Enerji bitince eylemler kilitlenir. | Pick an action. Actions lock when energy runs out. |
| noEnergy | Kilit nedeni | Enerji yetmiyor | Not enough energy |
| shieldMax | Kilit nedeni | Kalkan en üst seviyede | Shield is at the top level |
| noWalkToday | Kilit nedeni | Bugün yürüyüş yok | No walk today |
| noIce | Kilit nedeni | Yakında buz yok | No ice nearby |
| noGreenhouse | Kilit nedeni | Sera yok | No greenhouse |
| trimmed | Pati | Enerji yetmedi, plan kısaldı. Başka bir eylem seç. | Energy ran short, so the plan shrank. Pick another action. |
| patiPlanError | Pati | Plan çalışmadı. Eylemleri yeniden seç. | The plan did not run. Pick your actions again. |
| go | Düğme | Günü başlat | Start the day |

## 7. Haritada hedef seçme

| Anahtar | Kim | Türkçe | English |
| --- | --- | --- | --- |
| planHintPick | Düğme | Haritada seç | Pick on map |
| pickPrompt | Bant | Haritada bir yere dokun | Tap a spot on the map |
| pickIce | Pati | Buzlu bir kratere dokun. | Tap a shadowed crater. |
| pickWalk | Pati | Yürüyüş için bir yere dokun. | Tap a spot to walk to. |
| pickTooFar | Pati | Çok uzak: daha yakın bir yere dokun. | Too far: tap a closer spot. |
| pickNotIce | Pati | Burada buz yok: koyu gölgeli bir yere dokun. | No ice here: tap a dark shadowed spot. |
| pickSteep | Pati | Çok dik: başka bir yere dokun. | Too steep: tap another spot. |
| pickNoEnergy | Pati | Enerji yetmiyor: daha yakın bir yer seç. | Not enough energy: pick a closer spot. |
| pickResult | Pati | {d}: {n} enerji (ör. "1,4 km: 3 enerji") | {d}: {n} energy |
| pickDone | Etiket | Yer seçildi | Spot picked |
| pickCancel | Düğme | Vazgeç | Cancel |

## 8. Gün içinde: alarm

| Anahtar | Kim | Türkçe | English |
| --- | --- | --- | --- |
| alarm | Kırmızı bant | Alarm! Ekibi geri çağır | Alarm! Recall the crew |
| patiAlarm | Pati | Alarm! Ekibi hemen geri çağır! | Alarm! Recall the crew right now! |
| recall | Düğme | Geri çağır! | Recall! |
| patiRecalled | Pati | Aferin Komutan! Zamanında döndüler. | Well done, Commander! They made it back in time. |
| patiTooLate | Pati | Çok geç kaldık... | We were too late... |

## 9. Gün sonu raporu

| Anahtar | Kim | Türkçe | English |
| --- | --- | --- | --- |
| reportTitle | Başlık | Gün bitti | Day complete |
| inside / outsideFull / outsideRecalled | Doz satırı | içeride / dışarıda / dışarıda, zamanında döndü | inside / outside / outside, back in time |
| nextDay | Düğme | Sonraki gün | Next day |
| seeEnd | Düğme | Sonucu gör | See results |

Olay etiketleri: Alarm geldi · Fırtına sürüyor · Habersiz fırtına · Dünya ikmal yolladı · Yürüyüş iptal · Pil doldu, enerji boşa gitti · Karanlık gün · Erken dönüş (EN: Alarm · Storm ongoing · Surprise storm · Earth sent supplies · Walk cancelled · Battery full, energy wasted · Dark day · Early return).

Veri defteri cümleleri (gerçek değerlerle dolar):

| Konu | Türkçe | English |
| --- | --- | --- |
| Kule güneşi | {n}. kule bugün günün %{litPct} kadarında güneşte. | Tower {n} is in sunlight {litPct}% of today. |
| Uzay havası | Uzay havası: doz, sakin bir günün {oran} katıydı (aynı dedektör). | Space weather: dose was {ratio}x a quiet day (same detector). |
| Sakin gün | Sakin gün: sadece kozmik ışınlar. | A calm day: only galactic cosmic rays. |
| Alarm | Güneş parçacığı alarmı {alarmAt} zamanında geldi. | A solar particle alert came at {alarmAt} (measured). |
| Buz mesafesi | En yakın sürekli gölgeli bölge {m} m uzakta. | The nearest permanently shadowed region is {m} m away. |
| Kalkan | {seviye}. seviye siper dozu {bölen} kat azaltır. | A level {n} berm divides the dose by {divisor}. |
| Yürüyüş | (yalnızca İngilizce) | The crew walked {km} km to a permanently shadowed crater / a sunlit spot on the rim. |
| Not | Veri: CRaTER (RadLab). Bu pencerede 16 Mayıs sonrası için DONKI alarm verisi yok. | Data: CRaTER (RadLab). There is no DONKI alarm data after 16 May in our window. |
| Rozet | Arşiv: Mayıs 2024 (canlı değil) | Archive: May 2024 (not live) |

## 10. Bitiş ekranı ("Gerçekte ne oldu?")

| Anahtar | Kim | Türkçe | English |
| --- | --- | --- | --- |
| patiEnd | Pati | Görev bitti! Bak, gerçekte ne olmuş. | Mission over! Look at what really happened. |
| endTitle | Başlık | Gerçekte ne oldu? | What really happened? |
| endDone | Sonuç | Görev tamamlandı! | Mission complete! |
| endEarly | Sonuç | Ekip dinlenmek için erken döndü. | The crew flew home early to rest. |
| doseNow | Etiket | Senin dozun | Your dose |
| noShield | Etiket | Kalkansız doz olurdu | Without a shield the dose would be |
| stormElsewhere | Başlık | Aynı fırtına başka yerlerde (normal güne göre kat) | The same storm elsewhere (times a quiet day) |
| yerler | Çubuklar | Ay yörüngesi · Derin uzay · Uluslararası Uzay İstasyonu · Mars yüzeyi | Lunar orbit · Deep space · International Space Station · Mars surface |
| sunStoryTowers | Hikâye | Kulelerin güneşi {date} günü bitti. | The towers' sunlight ran out on {date}. |
| sunStory | Hikâye (yedek) | Güneş {date} sonrasında ufkun altına indi. | After {date} the Sun sank below the horizon. |
| sunStoryNone | Hikâye (yedek) | Bu bölgede Güneş ufka çok yakın dolanır. | Here the Sun circles very close to the horizon. |
| lesson | Ders | Güneş varken hazırlan: enerjiyi biriktir, kalkanı kur. Her seçimin bir bedeli var. | Prepare while the Sun is up: store energy, build your shield. Every choice has a cost. |
| tryAgain | Düğme | Tekrar dene | Try again |
| toLive / toArchive | Düğme | Bugünün Ay'ı / Mayıs 2024 görevi | Today's Moon / May 2024 mission |

Rozetler: Güneş avcısı · Buz madencisi · Güvenli liman · Bilim insanı (EN: Sun hunter · Ice miner · Safe harbor · Scientist).

## 11. Canlı mod ("Bugünün Ay'ı")

| Anahtar | Kim | Türkçe | English |
| --- | --- | --- | --- |
| liveComputing | Ekran | Bugünün Güneşi hesaplanıyor… | Working out today's Sun… |
| patiLive | Pati | Komutan, bu bugünün gerçek Güneşi ve gerçek uzay havası! | Commander, this is the real Sun and real space weather of today! |
| liveEndTitle | Başlık | Bugün Ay'da ne oldu? | What happened on the Moon today? |
| liveSunUp | Sonuç | Güneş bugün ufkun en fazla {el}° üstüne çıktı. | Today the Sun rose at most {el}° above the horizon. |
| liveSunDown | Sonuç | Güneş bugün hep ufkun altındaydı (merkez noktada). | Today the Sun stayed below the horizon (at the site centre). |
| liveTower | Sonuç | kule bugün güneşte | tower in sunlight today |
| liveCalm | Sonuç | Son 24 saatte güneş parçacığı olayı yok: sakin bir gün. | No solar particle event in the last 24 hours: a calm day. |
| liveStorm | Sonuç | Son 24 saatte güneş parçacığı olayı oldu: fırtına günü (dozun gerçek oranı bilinmiyor, varsayım). | A solar particle event in the last 24 hours: a storm day (real dose ratio unknown, assumption). |
| liveNoData | Sonuç | Canlı veri yok: bugünün uzay havasını gösteremiyoruz. | No live data: we cannot show today's space weather. |
| liveCme | Etiket | Dünya yönlü en yeni CME (ENLIL varış tahmini) | Newest Earth-directed CME (ENLIL arrival) |
| liveNoCme | Etiket | Penceredeki CME'lerin hiçbirinde Dünya için ENLIL varış zamanı yok. | No CME in the window has an ENLIL arrival time for Earth. |
| liveNotif | Etiket | En yeni NOAA/DONKI bildirimi | Newest NOAA/DONKI notification |
| liveFetched | Etiket | Veri alındı | Fetched |
| liveNote | Not | Güneş konumu bugün için hesaplandı; kulelerin gölgesi sadece bu 18 km'lik haritadan hesaplandı. | The Sun position is computed for today; tower shadows use only this 18 km map. |
| liveAgain | Pati | Yarın Güneş farklı bir yerde olacak, tekrar gel! | Tomorrow the Sun will be somewhere else. Come back! |

## 12. Göstergeler, düğmeler ve kaynaklar paneli

| Anahtar | Türkçe | English |
| --- | --- | --- |
| gaugeBattery / gaugeAir / gaugeDose / gaugeStars | Pil / Yaşam desteği / Radyasyon dozu / Bilim yıldızı | Battery / Life support / Radiation dose / Science stars |
| tabBrief / tabPlan / tabReport | Brifing / Plan / Rapor | Briefing / Plan / Report |
| checklist / listOpen / listClose | Görev listesi / Listeyi büyüt / Listeyi küçült | Mission checklist / Expand the list / Shrink the list |
| sunMap / iceMap / realLight / info | Güneş haritası / Buz haritası / Gerçek ışık / Kaynaklar | Sun map / Ice map / Real light / Sources |
| overview / ground | Üstten bak / Yüzeyden bak | Overview / Surface view |
| rotL / rotR / tiltUp / tiltDown / zoomIn / zoomOut | Sola döndür / Sağa döndür / Yukarı eğ / Aşağı eğ / Yakınlaştır / Uzaklaştır | Rotate left / Rotate right / Tilt up / Tilt down / Zoom in / Zoom out |
| play / pause / day / hour / timeToggle | Oynat / Durdur / Gün / Saat / Zaman çubuğu | Play / Pause / Day / Hour / Time bar |
| base / pole | Üs / Güney Kutbu | Base / South Pole |
| notebook / sources / close | Defter / Kaynaklar / Kapat | Notebook / Sources / Close |
| rulesTitle / dataTitle | Oyun kuralları: kaynak ve varsayımlar / Veri kaynakları | Game rules: sources and assumptions / Data sources |
| measured / assumption / ratioWord | ölçüm / varsayım / normal günün katı | measured / assumption / times a quiet day |
| placeholder | Örnek arazi (NASA verisi değil) | Placeholder terrain (not NASA data) |
| fillNote | Not: Gölgedeki yerler oyunda koyu maviyle gösterilir, görebilesin diye. Gerçekte Ay'ın gölgesi simsiyahtır. Düğmeyle gerçek karanlığı görebilirsin. | Note: shadowed ground is shown dark blue so you can see it. On the real Moon shadows are pitch black. Use the button to see true darkness. |

## 13. Pati görsellerinin ekran okuyucu açıklamaları

Pati mutlu · Pati göz kırpıyor · Pati şaşkın · Pati kararlı · Pati üzgün · Pati parmağıyla gösteriyor · Pati koşuyor · Pati sevinçle zıplıyor · Pati oturuyor · Pati el sallıyor · Pati göz kırpıp başparmağını kaldırıyor (EN: Pati is happy · winking · surprised · determined · sad · pointing · running · jumping for joy · sitting · waving · winks and gives a thumbs up).

## Metinleri okurken fark ettiğim sorunlar

- **Ham sayılar:** kule güneşi cümlesi oyunda "%87.6484375" gibi yuvarlanmamış görünüyor; alarm cümlesinde saat "2024-05-11T02:10Z" biçiminde, çocuk için okunaksız.
- **Aynı şeye iki ad:** eylemin adı "Kalkan katmanı", veri defterinde "siper" deniyor; biri seçilmeli.
- **Eksik çeviri:** "Yürüyüş" veri defteri cümlesi yalnızca İngilizce, Türkçe karşılığı yok.
- **Ton farkı:** "Çok geç kaldık..." üç noktayla biten tek satır; diğerleri yön veriyor. Örneğin "Çok geç kaldık. Ekip dozu aldı, yarın kalkanı unutmayalım." olabilir.
- **Çeviri tutarlılığı:** EN'de "Pick two" düğmesi ile "Go to building" arasında akış farklı fiiller kullanıyor; "Pick two" → "Start building" gibi tek fiil zinciri daha net.
- **Eski 2D sürümün metinleri** (`src/i18n/lines.ts`, `src/i18n/ui.ts`, yaklaşık 90 satır) bu listede yok; o sürüm yalnızca `#legacy` adresinden açılıyor.
