import { useEffect, useState } from 'react';
import { loadSettings } from '../storage/store';
import { loadTerrain } from '../three/data/terrain';
import type { TerrainData } from '../three/types';
import Game from './Game';
import type { GameProps } from './Game';
import { tx } from './text';
import type { L } from './text';
import './ui3d.css';

export type { MoonApi } from './Game';
export type App3DProps = Omit<GameProps, 'data' | 'lang' | 'setLang'>;

const LANG_KEY = 'astrakids3d.lang';
const getLang = (): L => {
  try {
    const s = localStorage.getItem(LANG_KEY);
    if (s === 'tr' || s === 'en') return s;
  } catch {
    /* ignore */
  }
  return 'en'; // English by default for first-time players; a tapped choice is persisted
};

export default function App3D(props: App3DProps) {
  const [data, setData] = useState<TerrainData | null>(null);
  const [lang, setLangState] = useState<L>(getLang);
  const [reduce, setReduce] = useState(false);
  const setLang = (l: L) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = l;
  };
  useEffect(() => {
    let off = false;
    void loadTerrain().then((d) => !off && setData(d));
    return () => {
      off = true;
    };
  }, []);
  useEffect(() => {
    let off = false;
    void loadSettings().then((s) => !off && setReduce(s.reduceMotion)).catch(() => undefined);
    return () => {
      off = true;
    };
  }, []);
  if (!data) return <div className="m3d-boot">{tx('loading', lang)}</div>;
  return <Game data={data} lang={lang} setLang={setLang} reduceMotion={reduce} {...props} />;
}
