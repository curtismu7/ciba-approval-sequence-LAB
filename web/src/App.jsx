import { useCallback, useEffect, useState } from "react";
import FlowTab from "./components/FlowTab.jsx";
import TalkTrack from "./components/TalkTrack.jsx";
import TopMenu, { applyFontSize } from "./top-menu/TopMenu";
import { getInfo, getTalkTrack, resetLab, setMode } from "./api";
import { TALK } from "./talkTrack";

export const TABS = [
  { id: "flow", label: "Sequence diagram" },
  { id: "talk", label: "Talk track" },
];

// The banner is never blank and never claims a mode before it knows: until /api/info answers (or if it fails)
// it says both, honestly. In Real mode (owner-configured server-side) the banner names what is real vs simulated.
const TAIL = "No real identity provider, gateway or API is called by this lab; the ten lifelines are a model, not live traffic.";
export const BANNER_UNKNOWN = `SIMULATED / HOSTED SIMULATION: mock tokens, a mock approval service and a mock flight API. ${TAIL}`;
export const bannerFor = (info) => {
  if (!info) return BANNER_UNKNOWN;
  if (info.source === "real" || info.mode === "real") {
    return `REAL MODE: Real-mode connections (if any) are owner-configured on the server; everything shown here is still the modelled sequence with its example wire data. ${TAIL}`;
  }
  return `SIMULATED: mock tokens (teaching values only), a mock approval service and a mock flight API. ${TAIL}`;
};

const THEMES = ["auto", "light", "dark"];

const hashParts = () => {
  const h = window.location.hash.replace("#", "");
  return TABS.some((t) => t.id === h) ? h : "flow";
};

export default function App() {
  const [info, setInfo] = useState(undefined); // undefined = loading, null = failed
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(hashParts());
  const [presenter, setPresenter] = useState(false);
  const [theme, setTheme] = useState(() => { try { const t = window.localStorage.getItem("cibalab.theme"); return THEMES.includes(t) ? t : "auto"; } catch { return "auto"; } });
  const [fontStep, setFontStep] = useState(() => { try { const f = window.localStorage.getItem("cibalab.font"); return ["S", "M", "L"].includes(f) ? f : "M"; } catch { return "M"; } });
  const [notice, setNotice] = useState("");
  const [talk, setTalk] = useState(TALK); // the raw data until the server answers with the cast-filled text
  const [brand, setBrand] = useState(""); // the cast brand of the story (AirGuard Airlines by default), from /api/talk-track

  useEffect(() => { getInfo().then(setInfo, (e) => { setInfo(null); setError(e.message); }); }, []);
  useEffect(() => { getTalkTrack().then((j) => { setTalk(j.talk || TALK); setBrand(typeof j.cast?.castBrand === "string" ? j.cast.castBrand : ""); }, () => setTalk(TALK)); }, []);
  useEffect(() => {
    const on = () => setTab(hashParts());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const select = (id) => { setTab(id); try { window.history.replaceState(null, "", `#${id}`); } catch { /* ignore */ } };

  useEffect(() => {
    const on = (e) => {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === "p" || e.key === "P") setPresenter((v) => !v);
      else if (e.key === "Escape") setPresenter(false);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", theme);
    try { window.localStorage.setItem("cibalab.theme", theme); } catch { /* storage blocked */ }
  }, [theme]);
  useEffect(() => {
    applyFontSize(fontStep);
    try { window.localStorage.setItem("cibalab.font", fontStep); } catch { /* storage blocked */ }
  }, [fontStep]);

  const reset = useCallback(async () => {
    const ok = await resetLab();
    setNotice(ok ? "Reset: the lab is back to its default state." : "Reset failed on the server.");
  }, []);

  const real = info ? Boolean(info.mode === "real" || info.source === "real") : false;
  return (
    <div className={`app${presenter ? " app--presenter" : ""}`}>
      <header className="shell-bar">
        <span className="shell-brand">
          <span className="shell-logo" aria-hidden="true">CA</span>
          <h1>CIBA Approval Sequence Lab</h1>
          {brand && <span className="shell-cast" data-testid="cast-brand">{brand}</span>}
          <span className={`shell-badge${real ? " shell-badge--real" : ""}`} data-testid="mode-badge">{real ? "Real" : "Mock"}</span>
        </span>
        <nav className="shell-nav" aria-label="Lab sections">
          {TABS.map((t) => (
            <a key={t.id} href={`#${t.id}`} aria-current={tab === t.id ? "page" : undefined}
              onClick={(e) => { e.preventDefault(); select(t.id); }}>{t.label}</a>
          ))}
        </nav>
        <TopMenu
          postman={{ repo: "curtismu7/ciba-approval-sequence-LAB", slug: "ciba-approval-sequence-lab" }}
          mode={{ value: real ? "real" : "mock", onChange: async (target) => {
            if (real === (target === "real")) return;
            const res = await setMode(target).catch(() => ({ ok: false, body: {} }));
            if (res.ok) { window.location.reload(); }
            else setNotice(res.body?.detail || "Could not switch mode.");
          }, realAvailable: info ? Boolean(info.realAvailable) : null, realHint: info?.realAvailable ? undefined : "Real is not configured: set REAL_CIBA_ENV_ID, REAL_CIBA_CLIENT_ID and REAL_CIBA_CLIENT_SECRET in the lab's .env (owner-run). Mock keeps working." }}
          theme={{ value: theme, onChange: setTheme }}
          fontSize={{ value: fontStep, onChange: setFontStep }}
          present={{ active: presenter, onToggle: () => setPresenter((v) => !v) }}
          talkTrack={{ active: tab === "talk", onToggle: () => select("talk") }}
          version={info?.version || null}
          onReset={reset}
        />
      </header>
      <main className="page">
        <p className="banner" role="status" data-testid="banner">{bannerFor(info)}</p>
        {info === null && <p className="app-error" role="alert">Could not load the lab ({error}). Is the server running?</p>}
        <p className="sr-only" role="status" aria-live="polite">{notice}</p>
        <div id={`panel-${tab}`}>
          {tab === "flow" && <FlowTab />}
          {tab === "talk" && <TalkTrack talk={talk} />}
        </div>
      </main>
    </div>
  );
}
