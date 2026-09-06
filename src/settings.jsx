import { useEffect, useMemo, useState } from "react";
import { ComicTitle, SiteFrame } from "./components.jsx";
import { THEME_KEY, loadSettings, saveSettings, applySettingsToDocument } from "./data.js";
import AdminPanel from "./admin-panel.jsx";

function Toggle({ label, checked, onChange }) {
  return <button type="button" role="switch" aria-checked={checked} className={`settings-switch ${checked ? "is-on" : ""}`} onClick={() => onChange(!checked)}>
    <span className="settings-switch-track"><span className="settings-switch-thumb" /></span>
    <span className="settings-switch-label">{label}</span>
  </button>;
}

export default function SettingsPage() {
  const [dark, setDark] = useState(() => localStorage.getItem(THEME_KEY) !== "light");
  const [settings, setSettings] = useState(() => loadSettings());
  const label = useMemo(() => dark ? "Switch to light mode" : "Switch to dark mode", [dark]);

  const toggle = () => {
    const nextDark = !dark;
    setDark(nextDark);
    localStorage.setItem(THEME_KEY, nextDark ? "dark" : "light");
    document.documentElement.dataset.theme = nextDark ? "dark" : "light";
  };

  const updateSetting = (key, value) => {
    setSettings((current) => {
      const next = { ...current, [key]: value };
      saveSettings(next);
      applySettingsToDocument(next);
      return next;
    });
  };

  const supportsVibration = typeof navigator !== "undefined" && "vibrate" in navigator;

  useEffect(() => { applySettingsToDocument(settings); }, []);

  return <SiteFrame active="settings">
    <main className="section-wrap page-section utility-page">
      <div className="page-heading"><div><p className="eyebrow">GLC27 / SETTINGS</p><ComicTitle>Set your <i>look.</i></ComicTitle></div></div>
      <section className="settings-grid">
        <article className="comic-panel paper-panel settings-card">
          <span className="panel-kicker">APPEARANCE</span>
          <ComicTitle as="h2">Theme</ComicTitle>
          <p>Choose the light or dark presentation for the website.</p>
          <button className={`comic-button ${dark ? "light-mode-button" : "dark-mode-button"} setting-toggle`} onClick={toggle}>{label} <span>↔</span></button>
          <small className="settings-footnote">Your preference is saved on this device.</small>
        </article>

        <article className="comic-panel paper-panel settings-card">
          <span className="panel-kicker">TEXT SIZE</span>
          <ComicTitle as="h2">Large text</ComicTitle>
          <p>Increase body and stat text size across the site for easier reading.</p>
          <Toggle label={settings.largeText ? "Large text on" : "Large text off"} checked={settings.largeText} onChange={(v) => updateSetting("largeText", v)} />
          <small className="settings-footnote">Applies everywhere, including the scorer desk.</small>
        </article>

        <article className="comic-panel paper-panel settings-card">
          <span className="panel-kicker">LAYOUT</span>
          <ComicTitle as="h2">Compact mode</ComicTitle>
          <p>Tighten panel padding and spacing to fit more on screen at once.</p>
          <Toggle label={settings.compactMode ? "Compact mode on" : "Compact mode off"} checked={settings.compactMode} onChange={(v) => updateSetting("compactMode", v)} />
          <small className="settings-footnote">Handy on smaller laptop screens.</small>
        </article>

        <article className="comic-panel paper-panel settings-card">
          <span className="panel-kicker">MOTION</span>
          <ComicTitle as="h2">Reduce motion</ComicTitle>
          <p>Turn off the pow-burst effects, morph animations, and page transitions.</p>
          <Toggle label={settings.reduceMotion ? "Reduce motion on" : "Reduce motion off"} checked={settings.reduceMotion} onChange={(v) => updateSetting("reduceMotion", v)} />
          <small className="settings-footnote">Also honours your device's reduced-motion setting automatically.</small>
        </article>

        <article className="comic-panel paper-panel settings-card">
          <span className="panel-kicker">FEEDBACK</span>
          <ComicTitle as="h2">Sound effects</ComicTitle>
          <p>Play short comic-style sound cues for boundaries and wickets.</p>
          <Toggle label={settings.soundEffects ? "Sound effects on" : "Sound effects off"} checked={settings.soundEffects} onChange={(v) => updateSetting("soundEffects", v)} />
          <small className="settings-footnote">Muted automatically if your device is on silent.</small>
        </article>

        <article className="comic-panel paper-panel settings-card">
          <span className="panel-kicker">MOBILE ONLY</span>
          <ComicTitle as="h2">Click vibration</ComicTitle>
          <p>Add a tiny haptic buzz when tapping buttons and scoring controls.</p>
          <Toggle label={settings.clickVibration ? "Vibration on" : "Vibration off"} checked={settings.clickVibration} onChange={(v) => updateSetting("clickVibration", v)} />
          <small className="settings-footnote">{supportsVibration ? "Supported on this device." : "Your current device or browser doesn't support vibration."}</small>
        </article>
      </section>
      <section className="settings-admin-section">
        <div className="settings-admin-divider"><span>RESTRICTED AREA</span><i /></div>
        <AdminPanel />
      </section>
    </main>
  </SiteFrame>;
}
