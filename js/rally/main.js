import { createLandmarks, loadVisits, saveVisits, WORLD, SPAWN, START_LINE, FINISH_LINE, driveHeightAt, roadAt, RIVER, CROSSINGS, riverAt, crossingPoint, crossingDeckHeight } from "./world.js";
import { createCarState, resetCar, stepCar, FIXED_STEP } from "./physics.js";
import { createScene } from "./scene.js";
import { RallyInput } from "./input.js";
import { RallyAudio } from "./audio.js";
import { RallyStops } from "./stops.js";
import { RallyTiming, formatTime, formatDelta } from "./timing.js";
import { RallyRecovery } from "./recovery.js";
import { enterImmersive } from "./fullscreen.js";

const $ = id => document.getElementById(id);
const pad = value => String(value).padStart(2, "0");
const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement(tag, attributes) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function populateStack(container, stack, max = stack.length) {
  container.replaceChildren();
  for (const tech of stack.slice(0, max)) {
    const tag = document.createElement("span");
    tag.textContent = tech;
    container.append(tag);
  }
  if (stack.length > max) {
    const more = document.createElement("span");
    more.textContent = `+${stack.length - max}`;
    container.append(more);
  }
}

export async function start() {
  const response = await fetch(new URL("../../resume.json", import.meta.url));
  if (!response.ok) throw new Error(`Could not load resume (${response.status}).`);
  const resume = await response.json();
  const landmarks = createLandmarks(resume);
  if (!landmarks.length) throw new Error("No places to discover in this resume.");
  const graphics = createScene($("rally-scene"), landmarks);
  const car = createCarState();
  const input = new RallyInput($("touch-surface"));
  const audio = new RallyAudio();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const portrait = window.matchMedia("(pointer: coarse) and (orientation: portrait)");
  let storage;
  try { storage = window.localStorage; } catch { /* Progress remains available for this session. */ }
  const visits = loadVisits(storage, landmarks);
  const stops = new RallyStops(landmarks, storage);
  const timing = new RallyTiming(landmarks, storage);
  const recovery = new RallyRecovery();
  if (stops.checkpoint) {
    resetCar(car, stops.restartPose); graphics.snapCamera(car);
    $("intro-description").textContent = `Continue from ${stops.checkpoint.name}. Your checkpoint and field notes are saved.`;
    $("start-button").firstChild.textContent = "Continue driving ";
  }
  let started = false, blurred = false, stopped = false;
  let currentSight = null, toastTimer = 0;
  let previousTime = 0, accumulator = 0, uiElapsed = 0;
  let lastSpeed = -1;
  let lastSafePose = stops.restartPose;
  let shownCheckpoint = stops.checkpoint, orbitPaused = reducedMotion.matches;
  const labels = [], mapDots = [], slots = [], destinations = [];
  const dialogs = [$("help-dialog"), $("travel-dialog")];
  const panel = $("project-panel");
  timing.travel(car); recovery.reset(car);

  $("intro-count").textContent = pad(landmarks.length);
  for (const sight of landmarks) {
    const label = document.createElement("div");
    label.className = "world-label";
    label.style.setProperty("--sight-color", sight.color);
    const name = document.createElement("span"); name.className = "world-label-name";
    const number = document.createElement("b"); number.textContent = pad(sight.index + 1);
    name.append(number, document.createTextNode(sight.name === "Supplier Success Accelerator" ? "Supplier Success" : sight.name));
    const subtitle = document.createElement("small"); subtitle.textContent = `${sight.label} / ${Math.round(sight.elevation)} M`;
    label.append(name, subtitle);
    $("world-labels").append(label); labels.push(label);

    const dot = svgElement("g", { transform: `translate(${sight.x} ${sight.z})`, class: "map-dot", role: "button", tabindex: "0", "aria-label": `Go to ${sight.name}` });
    dot.style.setProperty("--sight-color", sight.color);
    const title = svgElement("title", {}); title.textContent = sight.name; dot.append(title);
    const marker = svgElement("circle", { r: 24 });
    const numeral = svgElement("text", { "text-anchor": "middle", dy: ".35em" }); numeral.textContent = sight.index + 1;
    dot.append(marker, numeral);
    dot.addEventListener("click", () => travelTo(sight));
    dot.addEventListener("keydown", event => { if (["Enter", "Space"].includes(event.code)) { event.preventDefault(); event.stopPropagation(); travelTo(sight); } });
    $("map-sights").append(dot); mapDots.push(dot);

    const slot = document.createElement("i");
    slot.style.setProperty("--sight-color", sight.color);
    $("discovery-slots").append(slot); slots.push(slot);

    const item = document.createElement("li");
    const destination = document.createElement("button"); destination.className = "travel-destination";
    destination.dataset.sight = sight.id;
    destination.style.setProperty("--sight-color", sight.color);
    destination.setAttribute("aria-label", `Go to ${sight.name}, ${Math.round(sight.elevation)} metres`);
    const order = document.createElement("span"); order.className = "travel-number"; order.textContent = pad(sight.index + 1);
    const text = document.createElement("span"); text.className = "travel-info";
    const destinationName = document.createElement("strong"); destinationName.textContent = sight.name;
    const caption = document.createElement("small"); caption.textContent = `${sight.label} · ${Math.round(sight.elevation)} M`;
    const split = document.createElement("small"); split.className = "travel-split";
    text.append(destinationName, caption, split);
    const status = document.createElement("span"); status.className = "travel-status"; status.textContent = "↗"; status.setAttribute("aria-hidden", "true");
    destination.append(order, text, status);
    destination.addEventListener("click", () => travelTo(sight));
    item.append(destination); $("travel-list").append(item); destinations.push(destination);
  }
  $("map-river").append(svgElement("polyline", { points: RIVER.filter((_, i) => i % 3 === 0).map(([x, z]) => `${x.toFixed(1)},${z.toFixed(1)}`).join(" "), class: "map-river" }));
  const crossingLabels = CROSSINGS.map(crossing => {
    const element = document.createElement("div"); element.className = "world-label crossing-label";
    element.style.setProperty("--sight-color", crossing.type === "jump" ? "#e5c07b" : "#76c9d4");
    const title = document.createElement("span"); title.className = "world-label-name"; title.textContent = `${crossing.type === "jump" ? "↗" : "≈"} ${crossing.label}`;
    const caption = document.createElement("small"); caption.textContent = crossing.type === "jump" ? "KEEP YOUR SPEED / CLEAR THE RIVER" : "OVER THE MOUNTAIN STREAM";
    element.append(title, caption); $("world-labels").append(element);
    const along = crossing.type === "jump" ? -crossing.gap - 8 : 0;
    return { element, ...crossingPoint(crossing, along), y: crossingDeckHeight(crossing, along) + 7 };
  });
  for (const [line, title, caption] of [[START_LINE, "START / THE DESCENT", "CROSS THE LINE TO START THE CLOCK"], [FINISH_LINE, "FINISH", "ALL NINE CHECKPOINTS / ONE DESCENT"]]) {
    const element = document.createElement("div"); element.className = "world-label crossing-label";
    element.style.setProperty("--sight-color", "#e5c07b");
    const name = document.createElement("span"); name.className = "world-label-name"; name.textContent = title;
    const hint = document.createElement("small"); hint.textContent = caption;
    element.append(name, hint); $("world-labels").append(element);
    crossingLabels.push({ element, x: line.x, z: line.z, y: line.elevation + 10 });
  }
  for (const route of graphics.routes) {
    const points = route.samples.map(([x, z]) => `${x.toFixed(1)},${z.toFixed(1)}`).join(" ");
    $("map-routes").append(svgElement("polyline", { points, class: "map-road", "stroke-width": route.width * 0.42 }));
  }
  $("minimap").setAttribute("viewBox", `${-WORLD.width / 2} ${-WORLD.depth / 2} ${WORLD.width} ${WORLD.depth}`);

  function updateProgress() {
    const remainder = document.createElement("span"); remainder.textContent = `/ ${pad(landmarks.length)}`;
    $("visit-count").replaceChildren(document.createTextNode(`${pad(visits.size)} `), remainder);
    landmarks.forEach((sight, index) => {
      const visited = visits.has(sight.id);
      labels[index].classList.toggle("visited", visited);
      mapDots[index].classList.toggle("visited", visited);
      slots[index].classList.toggle("visited", visited);
      destinations[index].classList.toggle("visited", visited);
      destinations[index].querySelector(".travel-status").textContent = visited ? "✓ ↗" : "↗";
    });
    $("visit-caption").textContent = visits.size === landmarks.length ? "every story found" : "places discovered";
    if (visits.size === landmarks.length) $("next-stop").textContent = "Every chapter. A whole mountain of work.";
  }
  updateProgress();
  updateCheckpoint();
  updateTiming();

  function updateTiming() {
    const running = timing.status === "running", finished = timing.status === "finished";
    $("race-panel").dataset.status = timing.status;
    $("race-status").textContent = finished ? "FINISH / ALL CHECKPOINTS" : running ? (isPaused() ? "DESCENT / PAUSED" : "DESCENT / ON THE CLOCK") : timing.status === "ready" ? "READY / CROSS THE START LINE" : "FREE ROAM / START AT SUMMIT";
    $("race-time").textContent = formatTime(timing.status === "idle" ? null : timing.elapsed);
    const index = timing.times.length - 1;
    $("race-split-label").textContent = index >= 0 ? `${finished ? "FINISH" : `CP ${pad(index + 1)}`} · ${formatTime(timing.times[index])}` : "PREVIOUS DESCENT";
    const delta = index >= 0 ? timing.delta(index) : null;
    $("race-delta").textContent = index >= 0 ? formatDelta(delta) : timing.previous ? formatTime(timing.previous.at(-1)) : "—";
    $("race-delta").dataset.pace = delta === null ? "" : delta < 0 ? "ahead" : "behind";
    $("race-next").textContent = timing.next ? (timing.next.id === "finish" ? "Next: the finish arch ↓" : `Next: ${pad(timing.next.index + 1)} / ${timing.next.name}`) : finished ? "Descent complete. Another run?" : "Start in the circle before Rowte.io.";
    landmarks.forEach((sight, i) => {
      const current = timing.times[i], previous = timing.reference?.[i];
      destinations[i].querySelector(".travel-split").textContent = Number.isFinite(current)
        ? `SPLIT ${formatTime(current)} · ${formatDelta(timing.delta(i))}`
        : Number.isFinite(previous) ? `PREVIOUS ${formatTime(previous)}` : "";
    });
  }

  function updateCheckpoint() {
    const name = stops.checkpoint?.name || "Summit start";
    $("checkpoint-name").textContent = name;
    $("checkpoint-button").setAttribute("aria-label", `Restart from ${name} (R)`);
    $("checkpoint-button").title = `Restart from ${name} (R)`;
    landmarks.forEach((sight, index) => {
      mapDots[index].classList.toggle("checkpoint", stops.checkpoint === sight);
      destinations[index].classList.toggle("checkpoint", stops.checkpoint === sight);
    });
  }

  function announce(message) {
    $("announcement").textContent = message;
    $("toast").textContent = message;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $("toast").hidden = true; }, 4300);
  }

  function isSuspended() {
    return !started || blurred || document.hidden || portrait.matches || dialogs.some(dialog => dialog.open) || stopped;
  }

  function isPaused() { return isSuspended() || Boolean(stops.viewing); }

  function syncInput() {
    input.enabled = !isPaused() && !recovery.crashed;
    if (!input.enabled) {
      input.clear();
      accumulator = 0;
      audio.update(car, 0, true);
    }
    $("rally-scene").inert = portrait.matches;
    $("intro").inert = portrait.matches;
    panel.inert = portrait.matches;
    $("race-panel").inert = portrait.matches;
    document.querySelector(".rally-header").inert = portrait.matches;
  }

  function focusGame() {
    if (started && !isSuspended()) $(stops.viewing ? "project-title" : "rally-scene").focus({ preventScroll: true });
  }

  function openHelp() {
    if (stopped || portrait.matches || dialogs.some(dialog => dialog.open)) return;
    $("help-dialog").showModal();
    syncInput();
  }

  function openTravel() {
    if (stopped || portrait.matches || $("travel-dialog").open) return;
    dialogs.forEach(dialog => { if (dialog.open) dialog.close(); });
    $("travel-dialog").showModal();
    syncInput();
  }

  function beginDriving() {
    started = true;
    $("intro").hidden = true;
    document.body.classList.add("is-driving");
  }

  function travelTo(sight) {
    if (stopped || portrait.matches) return;
    enterImmersive(); closeProject(false);
    input.clear(); accumulator = 0;
    const pose = sight?.arrival || SPAWN;
    resetCar(car, pose);
    if (sight) stops.activate(sight); else stops.resetToSummit();
    stops.clearApproach(); stops.update(car, 0);
    shownCheckpoint = stops.checkpoint; updateCheckpoint();
    lastSafePose = { ...pose };
    timing.travel(car); recovery.reset(car); graphics.crashEffect.clear(); updateTiming();
    graphics.splashEffect.clear(); graphics.fireworks.clear();
    graphics.snapCamera(car);
    beginDriving();
    dialogs.forEach(dialog => { if (dialog.open) dialog.close(); });
    setNearby(null);
    discover();
    syncInput(); focusGame();
    announce(!sight ? "Summit start. Cross the chequered line to start the clock." : `${sight.name} · Free roam. New run returns to the start circle.`);
  }

  function showProject() {
    if (isPaused() || recovery.crashed || !stops.ready) return;
    const sight = stops.open();
    if (!sight) return;
    resetCar(car, { x: car.x, z: car.z, heading: car.heading });
    panel.style.setProperty("--rally-red", sight.color);
    $("project-eyebrow").textContent = `${pad(sight.index + 1)} / ${sight.label} / ${Math.round(sight.elevation)} M`;
    $("project-title").textContent = sight.name;
    $("project-meta").textContent = `${sight.company} · ${sight.role} · ${sight.period}`;
    $("project-description").textContent = sight.description;
    populateStack($("project-stack"), sight.stack);
    $("project-sections").replaceChildren();
    for (const subsection of sight.subsections) {
      const section = document.createElement("section"); section.className = "project-section";
      const heading = document.createElement("h3"); heading.textContent = subsection.title || "What I built";
      const list = document.createElement("ul");
      for (const item of subsection.items || []) { const li = document.createElement("li"); li.textContent = item; list.append(li); }
      section.append(heading, list); $("project-sections").append(section);
    }
    let url;
    try { url = new URL(sight.url); } catch { /* Some projects have no public website. */ }
    const safeUrl = url && ["https:", "http:"].includes(url.protocol);
    $("project-link").hidden = !safeUrl;
    if (safeUrl) $("project-link").href = url.href;
    else $("project-link").removeAttribute("href");
    panel.hidden = false;
    panel.classList.remove("expanded");
    $("expand-project").setAttribute("aria-expanded", "false");
    $("expand-project").textContent = "Wider view ↔";
    $("project-scroll").scrollTop = 0;
    $("details-button").setAttribute("aria-expanded", "true");
    $("nearby-card").hidden = true;
    orbitPaused = reducedMotion.matches; updateOrbitButton();
    document.body.classList.add("is-viewing-project");
    syncInput();
    $("project-title").focus({ preventScroll: true });
  }

  function updateOrbitButton() {
    $("orbit-button").setAttribute("aria-pressed", String(orbitPaused));
    $("orbit-button").textContent = orbitPaused ? "Resume camera ▶" : "Pause camera Ⅱ";
    $("orbit-button").disabled = reducedMotion.matches;
    if (reducedMotion.matches) $("orbit-button").textContent = "Still view";
  }

  function closeProject(focus = true) {
    stops.close(); panel.hidden = true;
    document.body.classList.remove("is-viewing-project");
    $("details-button").setAttribute("aria-expanded", "false");
    setNearby(stops.nearby);
    syncInput();
    if (focus) focusGame();
  }

  function setNearby(sight) {
    const changed = currentSight !== sight;
    currentSight = sight;
    $("nearby-card").hidden = !sight || Boolean(stops.viewing);
    if (!sight) return;
    $("nearby-card").classList.toggle("ready", stops.ready);
    $("stop-hint").textContent = stops.ready ? "Parked. Take a closer look." : "Brake to a stop to explore.";
    $("details-button").hidden = !stops.ready;
    $("details-button").disabled = !stops.ready;
    if (!changed) return;
    $("nearby-card").style.setProperty("--sight-color", sight.color);
    $("nearby-label").textContent = `${pad(sight.index + 1)} / ${sight.label}`;
    $("nearby-name").textContent = sight.name;
    $("nearby-description").textContent = sight.description;
    populateStack($("nearby-stack"), sight.stack, 4);
  }

  function discover() {
    if (stops.reached && !visits.has(stops.reached.id)) {
      visits.add(stops.reached.id);
      saveVisits(storage, visits);
      updateProgress();
      if (visits.size === landmarks.length) announce("Every story found. What a ride. Thanks for coming along!");
    }
    setNearby(stops.nearby);
    const progress = roadAt(car.x, car.z)?.progress ?? 0;
    const next = landmarks.find(sight => !visits.has(sight.id) && sight.courseDistance >= progress - 1);
    if (next && visits.size < landmarks.length) $("next-stop").textContent = `Next lookout: ${next.name === "Supplier Success Accelerator" ? "Supplier Success" : next.name}`;
    else if (visits.size < landmarks.length) $("next-stop").textContent = `${landmarks.length - visits.size} stories left — choose one in Projects ↗`;
    if (timing.status === "finished") $("next-stop").textContent = "Descent complete. Every checkpoint cleared.";
    else if (timing.next) $("next-stop").textContent = timing.next.id === "finish" ? "All checkpoints cleared. Finish under the arch ↓" : `Next checkpoint: ${pad(timing.next.index + 1)} / ${timing.next.name}`;
    else if (visits.size === landmarks.length) $("next-stop").textContent = "Every chapter. A whole mountain of work.";
  }

  function restartCheckpoint() {
    closeProject(false);
    input.clear();
    accumulator = 0;
    resetCar(car, stops.restartPose);
    stops.clearApproach(); stops.update(car, 0);
    lastSafePose = stops.restartPose; recovery.reset(car); graphics.crashEffect.clear();
    graphics.splashEffect.clear(); graphics.fireworks.clear();
    graphics.snapCamera(car);
    setNearby(null);
    discover(); syncInput(); focusGame();
    announce(`Restarted at ${stops.checkpoint?.name || "the summit start"}.`);
  }

  input.onAction = code => {
    if (code === "Escape") { if (stops.viewing) closeProject(); else openHelp(); }
    if (code === "KeyR" && !isSuspended()) restartCheckpoint();
    if (code === "KeyE") { if (stops.viewing) closeProject(); else showProject(); }
    if (code === "KeyM") openTravel();
  };
  $("start-button").addEventListener("click", () => {
    if (portrait.matches || stopped) return;
    enterImmersive(); beginDriving();
    syncInput(); focusGame();
    if (window.matchMedia("(pointer: coarse)").matches) announce("Left: drag to steer. Right: hold to drive, slide up to drift, down to reverse.");
  });
  $("help-button").addEventListener("click", openHelp);
  for (const id of ["travel-button", "map-button", "intro-travel-button"]) $(id).addEventListener("click", openTravel);
  $("details-button").addEventListener("click", showProject);
  $("reset-button").addEventListener("click", () => { restartCheckpoint(); $("help-dialog").close(); });
  $("checkpoint-button").addEventListener("click", restartCheckpoint);
  $("summit-button").addEventListener("click", () => travelTo(null));
  for (const id of ["close-project", "resume-driving"]) $(id).addEventListener("click", () => closeProject());
  $("orbit-button").addEventListener("click", () => { orbitPaused = !orbitPaused; updateOrbitButton(); });
  $("expand-project").addEventListener("click", () => {
    const expanded = panel.classList.toggle("expanded");
    $("expand-project").setAttribute("aria-expanded", String(expanded));
    $("expand-project").textContent = expanded ? "Compact view ↔" : "Wider view ↔";
  });
  panel.addEventListener("keydown", event => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || !["Escape", "KeyE", "KeyR", "KeyM"].includes(event.code)) return;
    event.preventDefault(); event.stopPropagation(); input.onAction(event.code);
  });
  reducedMotion.addEventListener("change", () => { if (reducedMotion.matches) orbitPaused = true; updateOrbitButton(); });
  $("sound-button").addEventListener("click", async () => {
    try {
      const enabled = await audio.toggle();
      $("sound-button").setAttribute("aria-pressed", String(enabled));
      $("sound-button").querySelector("span").textContent = enabled ? "Sound on" : "Sound off";
      audio.update(car, 0, isPaused());
    } catch { announce("Sound is unavailable in this browser. The road is still yours."); }
    focusGame();
  });
  document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => $(button.dataset.close).close()));
  for (const dialog of dialogs) {
    dialog.addEventListener("close", () => { syncInput(); focusGame(); });
    dialog.addEventListener("click", event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
  }
  window.addEventListener("blur", () => { blurred = true; syncInput(); });
  window.addEventListener("focus", () => { blurred = false; syncInput(); });
  document.addEventListener("visibilitychange", syncInput);
  portrait.addEventListener("change", () => {
    if (portrait.matches) dialogs.forEach(dialog => { if (dialog.open) dialog.close(); });
    graphics.resize(); syncInput();
  });
  window.addEventListener("resize", () => { graphics.resize(); syncInput(); });
  $("touch-surface").addEventListener("pointerdown", enterImmersive);
  $("rally-scene").addEventListener("webglcontextlost", event => {
    event.preventDefault(); stopped = true; syncInput();
    document.body.classList.add("has-error");
    closeProject(false);
    $("intro").hidden = true; $("nearby-card").hidden = true;
    dialogs.forEach(dialog => { if (dialog.open) dialog.close(); });
    $("error-message").textContent = "The graphics connection was interrupted. Reload to get back on the road; your discoveries are saved.";
    $("error-panel").hidden = false;
    $("retry-button").onclick = () => window.location.reload();
  });

  function frame(time) {
    if (stopped) return;
    requestAnimationFrame(frame);
    const dt = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 1 / 60;
    previousTime = time;
    const paused = isPaused();
    const control = input.sample();
    if (!paused) {
      accumulator += dt;
      const environment = { obstacles: graphics.obstacles, heightAt: driveHeightAt, supportAt: driveHeightAt, waterAt: riverAt };
      while (accumulator >= FIXED_STEP) {
        environment.onRoad = graphics.isRoad(car.x, car.z);
        if (!recovery.crashed) stepCar(car, control, FIXED_STEP, environment);
        const event = recovery.update(car, FIXED_STEP);
        accumulator -= FIXED_STEP;
        if (event === "water-entry") {
          graphics.splashEffect.splash(car, riverAt(car.x, car.z)?.y ?? car.y, reducedMotion.matches);
          audio.impact("splash");
        } else if (event === "explode") {
          graphics.crashEffect.explode(car, reducedMotion.matches);
          audio.impact("boom");
          stops.clearApproach(); setNearby(null); syncInput();
          announce("BOOM! Back to your checkpoint…");
        } else if (event === "splash" || event === "respawn") {
          const pose = event === "splash" ? lastSafePose : stops.restartPose;
          resetCar(car, pose); recovery.reset(car); graphics.crashEffect.clear();
          graphics.splashEffect.clear();
          input.clear(); accumulator = 0; stops.clearApproach();
          graphics.snapCamera(car); setNearby(null); syncInput();
          announce(event === "splash" ? "Splashed down. Back on the bank — keep some speed for the jump!" : `Back at ${stops.checkpoint?.name || "the summit"}.${timing.status === "running" ? " The clock keeps running." : " Ready to drive."}`);
        }
      }
    } else accumulator = 0;
    if (!paused) {
      stops.update(car, dt);
      if (shownCheckpoint !== stops.checkpoint) {
        shownCheckpoint = stops.checkpoint; updateCheckpoint();
        announce(`${stops.checkpoint.name} · Checkpoint saved. R restarts here.`);
      }
      const split = timing.update(car, dt, stops.reached);
      if (split) {
        discover();
        if (split.finished) graphics.fireworks.launch(FINISH_LINE, reducedMotion.matches);
        announce(`${split.finished ? "FINISH" : `CP ${pad(split.index + 1)}`} · ${formatTime(split.time)} · ${formatDelta(split.delta)}${split.delta === null ? "" : " vs previous descent"}`);
      }
    }
    const cameraSight = stops.viewing || (stops.ready ? stops.nearby : null);
    const cameraPanel = stops.viewing ? panel : $("nearby-card");
    const cameraInset = cameraSight ? cameraPanel.getBoundingClientRect().right + 24 : 0;
    graphics.render(car, isSuspended() && started ? 0 : dt, !paused && !recovery.crashed, reducedMotion.matches, {
      sight: cameraSight, orbit: Boolean(stops.viewing), paused: orbitPaused,
      panelWidth: cameraInset, checkpoint: stops.checkpoint, crashed: recovery.crashed,
    });
    audio.update(car, control.throttle, paused);
    uiElapsed += dt;
    if (uiElapsed >= 0.075) {
      uiElapsed = 0;
      updateTiming();
      const speed = Math.round(car.speed * 3.6);
      if (lastSpeed !== speed) { $("speed").textContent = speed; lastSpeed = speed; }
      $("surface").textContent = recovery.crashed ? "BOOM!" : car.inWater ? "SPLASH" : !car.grounded && car.airtime > 0.12 ? "AIRBORNE" : car.surface === "gravel" ? "GRAVEL" : "OFF ROAD";
      $("stage-name").textContent = roadAt(car.x, car.z)?.name || "THE SCENIC ROUTE";
      $("drift-status").classList.toggle("visible", car.drift && !paused);
      $("map-car").setAttribute("transform", `translate(${car.x.toFixed(2)} ${car.z.toFixed(2)}) rotate(${(car.heading * 180 / Math.PI).toFixed(1)}) scale(2.8)`);
      $("altitude").textContent = `${Math.round(car.y)} m`;
      $("ascent-meter").style.setProperty("--ascent", `${Math.max(0, Math.min(100, car.y / WORLD.summit * 100))}%`);
      if (!paused) discover();
      const road = roadAt(car.x, car.z);
      if (!paused && car.grounded && !car.inWater && road && road.distance < road.width / 2 && CROSSINGS.every(crossing => Math.hypot(car.x - crossing.x, car.z - crossing.z) > 58)) {
        lastSafePose = { x: road.x, z: road.z, heading: road.heading };
      }
    }
    const smallScreen = window.innerHeight < 550;
    const cardBounds = stops.viewing ? panel.getBoundingClientRect() : $("nearby-card").hidden ? null : $("nearby-card").getBoundingClientRect();
    const labelVisible = projected => projected.visible && projected.x > 90 && projected.x < window.innerWidth - 90
      && projected.y > (smallScreen ? 96 : 112) && projected.y < window.innerHeight - (smallScreen ? 88 : 132)
      && !(cardBounds && projected.x < cardBounds.right + 100 && projected.y > cardBounds.top - 10 && projected.y < cardBounds.bottom + 40);
    landmarks.forEach((sight, index) => {
      const projected = graphics.project(sight.x, sight.type === "tower" ? 19 : sight.type === "arcade" ? 13 : 11, sight.z);
      labels[index].hidden = Boolean(stops.viewing) || !labelVisible(projected);
      if (!labels[index].hidden) labels[index].style.transform = `translate(${Math.round(projected.x)}px, ${Math.round(projected.y)}px) translate(-50%, -100%)`;
    });
    crossingLabels.forEach(label => {
      const projected = graphics.project(label.x, label.y, label.z, true);
      label.element.hidden = Boolean(stops.viewing) || !labelVisible(projected) || Math.hypot(car.x - label.x, car.z - label.z) > 95;
      if (!label.element.hidden) label.element.style.transform = `translate(${Math.round(projected.x)}px, ${Math.round(projected.y)}px) translate(-50%, -100%)`;
    });
  }
  graphics.render(car, 1 / 60, false, reducedMotion.matches);
  $("loading").hidden = true;
  $("intro").hidden = false;
  document.body.classList.remove("is-loading");
  syncInput();
  requestAnimationFrame(frame);
}
