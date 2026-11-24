export async function clearSiteCaches() {
  if (typeof caches !== "undefined") {
    try {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    } catch (error) {
      console.warn("Could not clear Cache Storage:", error);
    }
  }

  if ("serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map((registration) => registration.unregister()),
      );
    } catch (error) {
      console.warn("Could not unregister service workers:", error);
    }
  }
}

export async function refreshSiteData() {
  await clearSiteCaches();
  window.location.reload();
}
