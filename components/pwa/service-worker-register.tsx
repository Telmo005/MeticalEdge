"use client";

import { useEffect } from "react";

/** Regista o service worker mínimo (public/sw.js) — sem isto o Chrome/
 *  Android não considera a app instalável, mesmo com manifest válido. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Falhar aqui nunca deve impedir a app de funcionar normalmente.
      });
    }
  }, []);

  return null;
}
