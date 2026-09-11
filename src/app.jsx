import { useMemo, useState } from "react";
import { ComicTitle, SiteFrame } from "./components.jsx";
import { isAndroid, isIOS, isStandalonePWA, loadSettings, saveSettings, applySettingsToDocument, sitePath } from "./data.js";

function Toggle({ label, checked, onChange, disabled = false, subtext = "" }) {
  return <div className={`app-setting ${disabled ? "is-disabled" : ""}`}>
    <button type="button" role="switch" aria-checked={checked} aria-disabled={disabled} disabled={disabled} className={`settings-switch ${checked ? "is-on" : ""}`} onClick={() => onChange(!checked)}>
      <span className="settings-switch-track"><span className="settings-switch-thumb" /></span><span className="settings-switch-label">{label}</span>
    </button>
    {subtext && <small className="app-setting-subtext">{subtext}</small>}
  </div>;
}

export default function AppPage() {
  const standalone = isStandalonePWA();
  const ios = isIOS();
  const android = isAndroid();
  const [settings, setSettings] = useState(() => loadSettings());
  const supportedNotification = standalone && typeof window !== "undefined" && "Notification" in window;

  const update = (key, value) => {
    setSettings((current) => {
      const next = { ...current, [key]: value };
      saveSettings(next);
      applySettingsToDocument(next);
      if (key === "fullScreen") {
        if (value && document.documentElement.requestFullscreen) void document.documentElement.requestFullscreen().catch(() => {});
        if (!value && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      }
      return next;
    });
  };

  const toggleNotifications = async (value) => {
    if (!value) return update("notifications", false);
    if (!supportedNotification) return;
    const permission = await Notification.requestPermission();
    update("notifications", permission === "granted");
  };

  const statusText = useMemo(() => standalone ? (android ? "Installed Android app" : ios ? "Installed iOS app" : "Installed app") : "Browser mode", [standalone, android, ios]);

  return <SiteFrame active="app">
    <main className="section-wrap page-section utility-page app-page">
      <div className="page-heading"><div><p className="eyebrow">GLC27 / APP</p><ComicTitle>App <i>control.</i></ComicTitle><p className="app-version-line">APP VERSION <b>v1.1.0</b> · {statusText}</p></div></div>
      {!standalone && <section className="app-install-note comic-panel paper-panel"><span className="panel-kicker">INSTALL THE APP</span><ComicTitle as="h2">More controls in the installed app.</ComicTitle><p>Install GLC27 to unlock device-level features such as fullscreen, notifications and Android live-score pinning.</p><a className="comic-button primary" href={sitePath("/")}>Return home ↗</a></section>}
      <section className="app-settings-grid">
        <article className="comic-panel paper-panel settings-card"><span className="panel-kicker">PWA CHROME</span><ComicTitle as="h2">Status + scrollbar</ComicTitle><p>Use the GLC theme for supported browser chrome and custom scrollbars.</p><Toggle label="Disable themed status bar & scrollbar" checked={settings.disableThemedChrome} onChange={(v) => update("disableThemedChrome", v)} disabled={ios} subtext={ios ? "Not supported on iOS." : "Turns both themed treatments off together."} /></article>
        <article className="comic-panel paper-panel settings-card"><span className="panel-kicker">PERFORMANCE</span><ComicTitle as="h2">Make app faster</ComicTitle><p>Remove all non-essential animation and heavy decorative effects for a much more immediate interface.</p><Toggle label="Make app faster" checked={settings.makeAppFaster} onChange={(v) => update("makeAppFaster", v)} subtext="For older devices which are unable to run this app smoothly" /></article>
        <article className="comic-panel paper-panel settings-card"><span className="panel-kicker">DISPLAY</span><ComicTitle as="h2">Full-screen</ComicTitle><p>Use the maximum available screen area when the platform allows it.</p><Toggle label="Enable full-screen" checked={settings.fullScreen} onChange={(v) => update("fullScreen", v)} disabled={ios} subtext={ios ? "Not supported on iOS." : "Browser support varies by device."} /></article>
        <article className="comic-panel paper-panel settings-card"><span className="panel-kicker">NOTIFICATIONS</span><ComicTitle as="h2">Device notifications</ComicTitle><p>Allow GLC27 to surface match notifications outside the active page.</p><Toggle label="Turn on notifications" checked={settings.notifications} onChange={toggleNotifications} disabled={!supportedNotification} subtext={!standalone ? "Install the app first." : "Permission is controlled by your device."} /></article>
        <article className="comic-panel paper-panel settings-card"><span className="panel-kicker">DEVICE</span><ComicTitle as="h2">Keep screen awake</ComicTitle><p>Prevent the display from sleeping while the app is active and supported.</p><Toggle label="Keep screen awake" checked={settings.keepAwake} onChange={(v) => update("keepAwake", v)} disabled={ios} subtext={ios ? "Not supported on iOS." : "Uses the Screen Wake Lock API where available."} /></article>
        <article className="comic-panel paper-panel settings-card"><span className="panel-kicker">VISUALS</span><ComicTitle as="h2">Reduce background effects</ComicTitle><p>Keep the GLC look while removing heavier ambient layers.</p><Toggle label="Reduce background effects" checked={settings.reduceBackground} onChange={(v) => update("reduceBackground", v)} /></article>
        <article className="comic-panel paper-panel settings-card"><span className="panel-kicker">STARTUP</span><ComicTitle as="h2">Last match</ComicTitle><p>When launching the installed app, return directly to the last match viewed.</p><Toggle label="Auto-open last match" checked={settings.autoOpenLastMatch} onChange={(v) => update("autoOpenLastMatch", v)} /></article>
        <article className="comic-panel paper-panel settings-card"><span className="panel-kicker">SCORER SAFETY</span><ComicTitle as="h2">Leave confirmation</ComicTitle><p>Ask before closing or navigating away from an active scorer page.</p><Toggle label="Confirm before leaving scorer" checked={settings.confirmLeaveScorer} onChange={(v) => update("confirmLeaveScorer", v)} /></article>
        <article className="comic-panel paper-panel settings-card"><span className="panel-kicker">LIVE SCORES</span><ComicTitle as="h2">Pin live scores</ComicTitle><p>Enable the Android PWA pin control on Match Viewer screens.</p><Toggle label="Pin live scores" checked={settings.pinLiveScores} onChange={(v) => update("pinLiveScores", v)} disabled={!standalone || !android} subtext="Available for Androids only" /></article>
      </section>
    </main>
  </SiteFrame>;
}
