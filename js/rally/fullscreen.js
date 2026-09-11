const coarse = window.matchMedia("(pointer: coarse)");

export function enterImmersive() {
  if (!coarse.matches || !document.fullscreenEnabled || document.fullscreenElement) return;
  document.documentElement.requestFullscreen({ navigationUI: "hide" })
    .then(() => screen.orientation?.lock?.("landscape"))
    .catch(() => {});
}
