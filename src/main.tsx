import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./services/monaco";
import "./styles/app.css";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    const controlledAtLoad = Boolean(navigator.serviceWorker.controller);
    let refreshing = false;

    if (controlledAtLoad) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    }

    void navigator.serviceWorker.register("./sw.js", {
      scope: "./",
      updateViaCache: "none"
    }).then((registration) => {
      void registration.update();
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
