import { createRoot } from "react-dom/client";
import "./styles.css";
import HomePage from "./home.jsx";
import ProgrammePage from "./programme.jsx";
import MatchesPage from "./matches.jsx";
import ViewerPage from "./viewer.jsx";
import ScorerPage from "./scorer.jsx";
import SettingsPage from "./settings.jsx";
import AboutPage from "./about.jsx";

const root = createRoot(document.getElementById("root"));
const path = window.location.pathname.replace(/\/+$/, "") || "/";
const base = (import.meta.env?.BASE_URL || "/").replace(/\/$/, "");
const relativePath = base && path === base
  ? "/"
  : (base && path.startsWith(`${base}/`) ? path.slice(base.length) : path);
const params = new URLSearchParams(window.location.search);
const matchId = params.get("match") || "D1";

let element;
switch (relativePath) {
  case "/":
  case "/index":
    element = <HomePage />;
    break;
  case "/programme":
    element = <ProgrammePage />;
    break;
  case "/matches":
    element = <MatchesPage />;
    break;
  case "/match":
    element = <ViewerPage matchId={matchId} />;
    break;
  case "/scorer":
    element = <ScorerPage matchId={matchId} superOverIndex={Number(params.get("super")) || 0} />;
    break;
  case "/settings":
    element = <SettingsPage />;
    break;
  case "/about":
    element = <AboutPage />;
    break;
  default:
    element = <HomePage />;
}

root.render(element);
