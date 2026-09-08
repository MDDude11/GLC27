import { createRoot } from "react-dom/client";
import "./styles.css";
import ScorerPage from "./scorer.jsx";
const params = new URLSearchParams(window.location.search);
createRoot(document.getElementById("root")).render(<ScorerPage matchId={params.get("match") || "D1"} superOverIndex={Number(params.get("super")) || 0} />);
