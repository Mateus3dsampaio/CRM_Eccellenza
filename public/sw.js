/* Service worker do CRM Eccellenza: só recebe os avisos do servidor (Web Push) e mostra a notificação do sistema.
 * Não guarda nada em cache e não mexe nas páginas. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let aviso = {};
  try {
    aviso = event.data ? event.data.json() : {};
  } catch (e) {
    aviso = {};
  }
  event.waitUntil(
    (async () => {
      // Com o CRM na frente (visível e com o foco), o próprio CRM mostra o aviso dentro da tela.
      const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (janelas.some((j) => j.visibilityState === "visible" && j.focused)) return;
      await self.registration.showNotification(aviso.titulo || "Eccellenza", {
        body: aviso.corpo || "",
        // Mesma marca do aviso que o CRM aberto mostra: um substitui o outro, nunca aparecem dois.
        tag: aviso.tag || undefined,
        icon: "/icone-192.png",
        badge: "/icone-192.png",
        data: { url: aviso.url || "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const aberta = janelas.find((j) => new URL(j.url).origin === self.location.origin);
      if (aberta) {
        await aberta.focus();
        // navigate() só existe em navegadores que o suportam; senão abre uma janela nova no endereço.
        if ("navigate" in aberta) {
          try {
            await aberta.navigate(destino);
            return;
          } catch (e) {
            /* cai para openWindow */
          }
        } else return;
      }
      await self.clients.openWindow(destino);
    })(),
  );
});
