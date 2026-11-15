import { MOON_RULES as R } from '../../game/moon';
import { BoltIcon, RadIcon, StarIcon } from '../icons';
import type { L } from '../text';
import { mt } from './text';

/** The suit's chest screen: battery segments, life-support tank, dose ring toward the limit, science stars. Glyphs only, no percentages. */
export function Gauges({ battery, cap, life, dose, science, extra = 0, lang }: { battery: number; cap: number; life: number; dose: number; science: number; extra?: number; lang: L }) {
  const lifeMax = R.life.max.value;
  const limit = R.radiation.doseLimit.value;
  const f = Math.max(0, Math.min(1, dose / limit));
  const lifeF = Math.max(0, Math.min(1, life / lifeMax));
  const hot = f >= 0.75; // lavender -> orange near the limit, never red
  const circ = 2 * Math.PI * 17;
  return (
    <div className="chest" role="group" aria-label={mt('gaugeBattery', lang) + ', ' + mt('gaugeAir', lang) + ', ' + mt('gaugeDose', lang) + ', ' + mt('gaugeStars', lang)} data-guide="chest">
      <div className="cx cx-bat" role="img" aria-label={`${mt('gaugeBattery', lang)}: ${Math.round(battery)} / ${cap}`}>
        <BoltIcon className="cx-ic sun" />
        <div className="cx-seg fine">
          {Array.from({ length: cap }, (_, i) => (
            <i key={i} className={i < battery ? 'on' : i < battery + extra ? 'ghost' : ''} />
          ))}
        </div>
        {/* narrow screens: each segment = 2 units, so 20 units read as 10 */}
        <div className="cx-seg coarse">
          {Array.from({ length: Math.ceil(cap / 2) }, (_, i) => (
            <i key={i} className={battery >= 2 * i + 2 ? 'on' : battery >= 2 * i + 1 ? 'half' : battery + extra > 2 * i ? 'ghost' : ''} />
          ))}
        </div>
      </div>
      <div className="cx cx-air" role="img" aria-label={`${mt('gaugeAir', lang)}: ${Math.round(life)} / ${lifeMax}`}>
        <svg viewBox="0 0 32 44" className={`cx-tank ${lifeF < 0.3 ? 'low' : ''}`}>
          <defs>
            <clipPath id="cx-tank-clip">
              <rect x="5" y="8" width="22" height="33" rx="8" />
            </clipPath>
          </defs>
          <path d="M12 3h8" className="cx-tank-cap" />
          <g clipPath="url(#cx-tank-clip)">
            <rect x="5" y="8" width="22" height="33" className="cx-tank-bg" />
            <rect x="5" y={8 + 33 * (1 - lifeF)} width="22" height={33 * lifeF} className="cx-tank-fill" />
          </g>
          <rect x="5" y="8" width="22" height="33" rx="8" className="cx-tank-line" />
        </svg>
      </div>
      <div className="cx cx-dose" role="img" aria-label={`${mt('gaugeDose', lang)}: ${Math.round(dose)} / ${limit}`}>
        <svg viewBox="0 0 44 44" className="cx-ring">
          <circle cx="22" cy="22" r="17" className="cx-ring-bg" />
          <circle cx="22" cy="22" r="17" className={`cx-ring-arc ${hot ? 'hot' : ''}`} strokeDasharray={`${circ * f} ${circ}`} transform="rotate(-90 22 22)" />
        </svg>
        <RadIcon className={`cx-radic ${hot ? 'hot' : ''}`} />
      </div>
      <div className="cx cx-sci" role="img" aria-label={`${mt('gaugeStars', lang)}: ${science}`}>
        <StarIcon className="cx-ic sun" />
        <b>{science}</b>
      </div>
    </div>
  );
}
