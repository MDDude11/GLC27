import { createRoot } from "react-dom/client";
import "./styles.css";
import ViewerPage from "./viewer.jsx";
const params = new URLSearchParams(window.location.search);
createRoot(document.getElementById("root")).render(<ViewerPage matchId={params.get("match") || "D1"} />);
