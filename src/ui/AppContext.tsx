import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { engine } from '../audio/engine';
import { lineText } from '../i18n/lines';
import type { Lang, LineId } from '../i18n/lines';
import { ui as uiText } from '../i18n/ui';
import type { UiKey } from '../i18n/ui';
import { defaultSettings, getSeenTutorial, loadSettings, saveSettings, setSeenTutorial } from '../storage/store';
import type { Settings } from '../storage/store';
import type { Mode } from '../game/types';

interface AppCtx {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  lang: Lang;
  mode: Mode;
  setMode: (m: Mode) => void;
  seenTutorial: boolean;
  markTutorialSeen: () => void;
  captionsOn: boolean;
  t: (key: UiKey) => string;
  // voice
  caption: string | null;
  say: (id: LineId) => Promise<boolean>;
  /** Speak an instruction; it becomes the one replayed on Pati tap. `shortId` is used for the 6 s repeat. */
  instruct: (id: LineId, shortId?: LineId) => Promise<boolean>;
  replay: () => void;
  repeatShort: () => void;
  stopVoice: () => void;
}

const Ctx = createContext<AppCtx | null>(null);
export const useApp = (): AppCtx => {
  const c = useContext(Ctx);
  if (!c) throw new Error('AppProvider missing');
  return c;
};

export function AppProvider({ children, initialMode }: { children: ReactNode; initialMode?: Mode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [mode, setMode] = useState<Mode>(initialMode ?? 'playmate');
  const [seenTutorial, setSeen] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const last = useRef<{ id: LineId; shortId?: LineId } | null>(null);
  const captionTimer = useRef<number>(0);

  useEffect(() => {
    let alive = true;
    // Never block the app on storage: fall back to defaults after 1.5 s.
    const timeout = window.setTimeout(() => alive && setReady(true), 1500);
    void Promise.all([loadSettings(), getSeenTutorial()]).then(([s, seen]) => {
      if (!alive) return;
      setSettings(s);
      setSeen(seen);
      setReady(true);
    });
    return () => {
      alive = false;
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = settings.reduceMotion ? 'true' : 'false';
    document.documentElement.lang = settings.lang;
    engine.setVolumes({ music: settings.music, sfx: settings.sfx, voice: settings.voice });
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void saveSettings(next);
      return next;
    });
  }, []);

  const lang = settings.lang;
  const captionsOn = settings.captions === 'on' || (settings.captions === 'auto' && mode === 'captain');

  const say = useCallback(
    async (id: LineId) => {
      window.clearTimeout(captionTimer.current);
      setCaption(lineText(id, lang));
      const ok = await engine.say(id, lineText(id, lang), lang);
      if (ok) captionTimer.current = window.setTimeout(() => setCaption(null), 1200);
      return ok;
    },
    [lang],
  );
  const instruct = useCallback(
    (id: LineId, shortId?: LineId) => {
      last.current = { id, shortId };
      return say(id);
    },
    [say],
  );
  const replay = useCallback(() => {
    if (last.current) void say(last.current.id);
  }, [say]);
  const repeatShort = useCallback(() => {
    if (last.current) void say(last.current.shortId ?? last.current.id);
  }, [say]);
  const stopVoice = useCallback(() => {
    engine.stopVoice();
    setCaption(null);
  }, []);
  const markTutorialSeen = useCallback(() => {
    setSeen(true);
    void setSeenTutorial(true);
  }, []);
  const t = useCallback((key: UiKey) => uiText(key, lang), [lang]);

  const value = useMemo<AppCtx>(
    () => ({
      settings, updateSettings, lang, mode, setMode, seenTutorial, markTutorialSeen, captionsOn, t,
      caption, say, instruct, replay, repeatShort, stopVoice,
    }),
    [settings, updateSettings, lang, mode, seenTutorial, markTutorialSeen, captionsOn, t, caption, say, instruct, replay, repeatShort, stopVoice],
  );

  if (!ready) return null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function Caption() {
  const { caption, captionsOn } = useApp();
  if (!captionsOn || !caption) return null;
  return (
    <div className="caption" role="status" aria-live="polite">
      {caption}
    </div>
  );
}

