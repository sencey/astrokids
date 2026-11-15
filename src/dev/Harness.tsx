import { useState } from 'react';
import fixture from '../game/__tests__/fixtures/may-2024.fixture.json';
// SWAP POINT: to use the real data, replace the line above with
//   import fixture from '../data/scenarios/may-2024.json';
import { applyDay, currentDay, isFinished, startMission, summary, formatHoursMinutes } from '../game/mission';
import { earnedBadges } from '../game/badges';
import { getConfig } from '../game/rules';
import type { MissionState, Mode, Scenario } from '../game/types';

const scenario = fixture as unknown as Scenario;

export default function Harness() {
  const [mode, setMode] = useState<Mode>('captain');
  const [mission, setMission] = useState<MissionState>(() => startMission(scenario, 'captain'));
  const [balls, setBalls] = useState({ water: 0, garden: 0, wall: 0 });
  const [location, setLocation] = useState<'inside' | 'outside'>('outside');
  const [tapped, setTapped] = useState(false);

  const cfg = getConfig(mode);
  const day = currentDay(mission);
  const spent = balls.water + balls.garden + balls.wall;

  const changeMode = (m: Mode) => {
    setMode(m);
    setMission(startMission(scenario, m));
    setBalls({ water: 0, garden: 0, wall: 0 });
  };

  const next = () => {
    if (spent > cfg.ballsPerDay) return alert(`Max ${cfg.ballsPerDay} balls`);
    setMission(applyDay(mission, { balls, location, alarmTappedInTime: tapped }).nextState);
    setBalls({ water: 0, garden: 0, wall: 0 });
    setTapped(false);
  };

  const ballInput = (k: 'water' | 'garden' | 'wall') => (
    <label key={k} style={{ marginRight: 8 }}>
      {k}{' '}
      <input
        type="number"
        min={0}
        value={balls[k]}
        style={{ width: 48 }}
        onChange={(e) => setBalls({ ...balls, [k]: Math.max(0, Math.floor(Number(e.target.value))) })}
      />
    </label>
  );

  return (
    <div style={{ fontFamily: 'monospace', padding: 12 }}>
      <h3>Pati debug harness</h3>
      <label>
        Mode{' '}
        <select value={mode} onChange={(e) => changeMode(e.target.value as Mode)}>
          <option value="captain">captain</option>
          <option value="playmate">playmate</option>
        </select>
      </label>
      <p>
        water {mission.water} | garden {mission.garden} | wall {mission.wall} | jar {mission.jar} | samples{' '}
        {mission.samples} | resupplies {mission.resupplies}
      </p>

      {day && (
        <div>
          <h4>
            Day {day.dayIndex} - {day.date} - band {day.sparkleBand}
            {day.bandIsAssumption ? ' (assumed)' : ''} - ratio {String(day.sparkleRatio)}
          </h4>
          <div>alarmAt: {day.alarmAt ?? 'none'}</div>
          <div>flares: {day.flares.map((f) => `${f.classType}@${f.peakTime}`).join(', ') || 'none'}</div>
          <div>
            forecasts:{' '}
            {day.forecasts.map((f) => `${f.simulationId} est ${f.estShockArrivalEarth} kp ${f.kp90}/${f.kp180}`).join('; ') || 'none'}
          </div>
          <div>shocks: {day.shocks.map((s) => s.eventTime).join(', ') || 'none'}</div>
          <p>
            Balls ({spent}/{cfg.ballsPerDay}): {(['water', 'garden', 'wall'] as const).map(ballInput)}
          </p>
          <p>
            <label>
              <input type="radio" checked={location === 'outside'} onChange={() => setLocation('outside')} /> outside
            </label>{' '}
            <label>
              <input type="radio" checked={location === 'inside'} onChange={() => setLocation('inside')} /> inside
            </label>{' '}
            <label>
              <input type="checkbox" checked={tapped} onChange={(e) => setTapped(e.target.checked)} /> alarm tapped in
              time
            </label>
          </p>
          <button onClick={next}>Next day</button>
        </div>
      )}

      <h4>Log</h4>
      <ul>
        {mission.results.map((r) => (
          <li key={r.dayIndex}>
            day {r.dayIndex} {r.band}: {r.exposure}, dose {r.dose} (base {r.baseSparkle}, wall {r.wallLevel}), sample{' '}
            {r.sampleGained ? 'yes' : r.sampleLost ? 'lost' : 'no'}, water {r.waterAfter}, garden {r.gardenAfter}, jar{' '}
            {r.jarAfter}
          </li>
        ))}
      </ul>

      {isFinished(mission) && (
        <div>
          <h4>Summary</h4>
          <pre>{JSON.stringify(summary(mission), null, 2)}</pre>
          <div>badges: {earnedBadges(mission).join(', ') || 'none'}</div>
          <div>
            forecast error:{' '}
            {summary(mission)
              .forecastErrors.map((f) => `${f.simulationId} ${f.errorMinutes === null ? 'n/a' : formatHoursMinutes(f.errorMinutes)}`)
              .join('; ')}
          </div>
        </div>
      )}
    </div>
  );
}
