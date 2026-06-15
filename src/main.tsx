import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";

import App from "./App";
import Pill from "./Pill";
import "./index.css";

function resolveLabel(): string {
  try {
    return getCurrentWindow().label;
  } catch {
    return "main";
  }
}

const isPill =
  resolveLabel() === "pill" ||
  new URLSearchParams(window.location.search).get("view") === "pill";

if (isPill) {
  // The pill window is transparent — drop the opaque app background.
  document.documentElement.style.background = "transparent";
  document.body.style.background = "transparent";
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{isPill ? <Pill /> : <App />}</React.StrictMode>,
);
