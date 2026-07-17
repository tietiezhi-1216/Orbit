import React from "react";
import ReactDOM from "react-dom/client";
import { CapsuleApp } from "@/features/capsule/capsule-app";
import "@/index.css";

/** `?mock` (dev only) stubs the Tauri bridge so the UI runs in a plain browser. */
async function bootstrap() {
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("mock")) {
    const { installTauriMock } = await import("@/dev/tauri-mock");
    installTauriMock();
  }

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <CapsuleApp />
    </React.StrictMode>,
  );
}

void bootstrap();
