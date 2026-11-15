# Pati voice lines for ElevenLabs (English)

31 lines. Generate one MP3 per line, name it exactly as in the "File" column, and put all files in `public/audio/voice/en/`. The game plays the MP3 if it exists and falls back to the browser voice if not, so lines can be added one at a time.

Character: Pati, a friendly, upbeat space dog who advises the young commander (ages 7–12). Warm, clear, a little playful, never scary. Speak slowly enough for a 7-year-old.

## Opening and setup

| File | Line |
| --- | --- |
| moon3d.welcome.mp3 | Commander, welcome to the Moon's south pole! Where shall we build our base? |
| moon3d.patiMode.mp3 | Which mission are we flying, Commander? |
| moon3d.cargoPrompt.mp3 | Commander, the lander can carry only two extra loads. Which ones do we take? |
| moon3d.placeHabitat.mp3 | Place the habitat first. Near ice, or sunny? |
| moon3d.placeTower.mp3 | Now the solar towers. Find sunny spots! |
| moon3d.placeGreenhouse.mp3 | Place your greenhouse too. |
| moon3d.placeReady.mp3 | All set! Shall we start the mission? |

## Guided first day

| File | Line |
| --- | --- |
| moon3d.guide1.mp3 | These are your gauges: battery, air, dose and stars. |
| moon3d.guide2.mp3 | Here is today's Sun. Press Plan the day. |
| moon3d.guide3.mp3 | Pick Keep base running so the air lasts. |
| moon3d.guide4.mp3 | Now pick Shield layer, it lowers your dose. |
| moon3d.guide5.mp3 | Ready! Press Start the day. |
| moon3d.guide6.mp3 | The day is done. Read the report: what did you spend and gain? |

## Morning briefing (one per day)

| File | Line |
| --- | --- |
| moon3d.patiBriefSuper.mp3 | Commander, a giant storm! A shield is a must! |
| moon3d.patiBriefStorm.mp3 | Commander, a solar storm! Stay inside or build a shield! |
| moon3d.patiBriefAlert.mp3 | Commander, an alert may come! Careful outside! |
| moon3d.patiBriefDark.mp3 | The Sun is below the horizon today, so the towers make no power. Watch the battery! |
| moon3d.patiBriefEmpty.mp3 | The battery is empty! Spend energy very carefully. |
| moon3d.patiBriefLife.mp3 | Life support is low! We need ice or the greenhouse. |
| moon3d.patiBriefCalm.mp3 | Commander, a calm day. Spend your energy wisely! |
| moon3d.patiLive.mp3 | Commander, this is the real Sun and real space weather of today! |

## Picking a spot on the map

| File | Line |
| --- | --- |
| moon3d.pickIce.mp3 | Tap a shadowed crater. |
| moon3d.pickWalk.mp3 | Tap a spot to walk to. |
| moon3d.pickTooFar.mp3 | Too far: tap a closer spot. |
| moon3d.pickNotIce.mp3 | No ice here: tap a dark shadowed spot. |
| moon3d.pickSteep.mp3 | Too steep: tap another spot. |

## Alarm, problems and the end

| File | Line |
| --- | --- |
| moon3d.patiAlarm.mp3 | Alarm! Recall the crew right now! |
| moon3d.patiRecalled.mp3 | Well done, Commander! They made it back in time. |
| moon3d.patiTooLate.mp3 | We were too late... |
| moon3d.patiPlanError.mp3 | The plan did not run. Pick your actions again. |
| moon3d.patiEnd.mp3 | Mission over! Look at what really happened. |

## Plain list (one line per row, same order as above)

```
Commander, welcome to the Moon's south pole! Where shall we build our base?
Which mission are we flying, Commander?
Commander, the lander can carry only two extra loads. Which ones do we take?
Place the habitat first. Near ice, or sunny?
Now the solar towers. Find sunny spots!
Place your greenhouse too.
All set! Shall we start the mission?
These are your gauges: battery, air, dose and stars.
Here is today's Sun. Press Plan the day.
Pick Keep base running so the air lasts.
Now pick Shield layer, it lowers your dose.
Ready! Press Start the day.
The day is done. Read the report: what did you spend and gain?
Commander, a giant storm! A shield is a must!
Commander, a solar storm! Stay inside or build a shield!
Commander, an alert may come! Careful outside!
The Sun is below the horizon today, so the towers make no power. Watch the battery!
The battery is empty! Spend energy very carefully.
Life support is low! We need ice or the greenhouse.
Commander, a calm day. Spend your energy wisely!
Commander, this is the real Sun and real space weather of today!
Tap a shadowed crater.
Tap a spot to walk to.
Too far: tap a closer spot.
No ice here: tap a dark shadowed spot.
Too steep: tap another spot.
Alarm! Recall the crew right now!
Well done, Commander! They made it back in time.
We were too late...
The plan did not run. Pick your actions again.
Mission over! Look at what really happened.
```

## Not in this list

- **The distance line** ("1.4 km: 3 energy") changes every time, so it stays on the browser voice.
- **Tapping Pati to repeat a line** currently re-reads the bubble with the browser voice instead of replaying the MP3; this needs a small code fix.
