// Service worker mínimo — não existe para dar offline "a sério" (esta app
// não faz sentido sem ligação, é tudo dados ao vivo), existe só para o
// Android/Chrome considerarem a app "instalável" (critério de PWA exige um
// service worker registado). Não intercepta nada: deixa cada pedido ir
// sempre à rede, como se não houvesse service worker nenhum.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
