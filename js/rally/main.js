import { createLandmarks, loadVisits, saveVisits, WORLD, SPAWN, driveHeightAt, roadAt, RIVER, CROSSINGS, riverAt, crossingPoint, crossingDeckHeight } from "./world.js";
import { createCarState, resetCar, stepCar, FIXED_STEP } from "./physics.js";
import { createScene } from "./scene.js";
import { RallyInput } from "./input.js";
import { RallyAudio } from "./audio.js";

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
  let started = false, blurred = false, stopped = false;
  let currentSight = null, toastTimer = 0;
  let previousTime = 0, accumulator = 0, uiElapsed = 0;
  let lastSpeed = -1;
  let waterTime = 0, lastSafePose = { ...SPAWN };
  const labels = [], mapDots = [], slots = [], destinations = [];
  const dialogs = [$("project-dialog"), $("help-dialog"), $("travel-dialog")];

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
    text.append(destinationName, caption);
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

  function announce(message) {
    $("announcement").textContent = message;
    $("toast").textContent = message;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $("toast").hidden = true; }, 4300);
  }

  function isPaused() {
    return !started || blurred || document.hidden || portrait.matches || dialogs.some(dialog => dialog.open) || stopped;
  }

  function syncInput() {
    input.enabled = !isPaused();
    if (!input.enabled) {
      input.clear();
      accumulator = 0;
      audio.update(car, 0, true);
    }
    $("rally-scene").inert = portrait.matches;
    $("intro").inert = portrait.matches;
    document.querySelector(".rally-header").inert = portrait.matches;
  }

  function focusRoad() {
    if (started && !isPaused()) $("rally-scene").focus({ preventScroll: true });
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
    input.clear(); accumulator = 0;
    resetCar(car, sight.arrival);
    lastSafePose = { ...sight.arrival }; waterTime = 0;
    graphics.snapCamera(car);
    beginDriving();
    dialogs.forEach(dialog => { if (dialog.open) dialog.close(); });
    setNearby(null);
    discover();
    syncInput(); focusRoad();
    announce(`${sight.name} · ${Math.round(sight.elevation)} m. Ready for the next stretch.`);
  }

  function showProject() {
    if (!currentSight || isPaused()) return;
    const sight = currentSight;
    const dialog = $("project-dialog");
    dialog.style.setProperty("--rally-red", sight.color);
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
    dialog.showModal(); dialog.scrollTop = 0;
    syncInput();
  }

  function setNearby(sight) {
    if (currentSight === sight) return;
    currentSight = sight;
    $("nearby-card").hidden = !sight;
    if (!sight) return;
    $("nearby-card").style.setProperty("--sight-color", sight.color);
    $("nearby-label").textContent = `${pad(sight.index + 1)} / ${sight.label}`;
    $("nearby-name").textContent = sight.name;
    $("nearby-description").textContent = sight.description;
    populateStack($("nearby-stack"), sight.stack, 4);
  }

  function discover() {
    let nearest = null, distance = Infinity;
    for (const sight of landmarks) {
      const d = Math.hypot(car.x - sight.marker[0], car.z - sight.marker[1]);
      if (d < distance) { nearest = sight; distance = d; }
    }
    const canStop = car.grounded && !car.inWater && Math.abs(car.y - nearest.elevation) < 3;
    if (canStop && distance < 9 && !visits.has(nearest.id)) {
      visits.add(nearest.id);
      saveVisits(storage, visits);
      updateProgress();
      announce(visits.size === landmarks.length ? "Every story found. What a ride. Thanks for coming along!" : `${pad(visits.size)} / ${pad(landmarks.length)} — ${nearest.name} discovered`);
    }
    if (canStop && (distance < 9 || (nearest === currentSight && distance < 15))) setNearby(nearest);
    else setNearby(null);
    const progress = roadAt(car.x, car.z)?.progress ?? 0;
    const next = landmarks.find(sight => !visits.has(sight.id) && sight.courseDistance >= progress - 1);
    if (next && visits.size < landmarks.length) $("next-stop").textContent = `Next lookout: ${next.name === "Supplier Success Accelerator" ? "Supplier Success" : next.name}`;
    else if (visits.size < landmarks.length) $("next-stop").textContent = `${landmarks.length - visits.size} stories left — choose one in Projects ↗`;
  }

  function returnToStart() {
    input.clear();
    accumulator = 0;
    resetCar(car);
    lastSafePose = { ...SPAWN }; waterTime = 0;
    graphics.snapCamera(car);
    setNearby(null);
    announce("Back at the summit start. Your discoveries are saved.");
  }

  input.onAction = code => {
    if (code === "Escape") openHelp();
    if (code === "KeyR" && !isPaused()) returnToStart();
    if (code === "KeyE") showProject();
    if (code === "KeyM") openTravel();
  };
  $("start-button").addEventListener("click", () => {
    if (portrait.matches || stopped) return;
    beginDriving();
    syncInput(); focusRoad();
    if (window.matchMedia("(pointer: coarse)").matches) announce("Left: drag to steer. Right: hold to drive, slide up to drift, down to reverse.");
  });
  $("help-button").addEventListener("click", openHelp);
  for (const id of ["travel-button", "map-button", "intro-travel-button"]) $(id).addEventListener("click", openTravel);
  $("details-button").addEventListener("click", showProject);
  $("reset-button").addEventListener("click", () => { returnToStart(); $("help-dialog").close(); });
  $("sound-button").addEventListener("click", async () => {
    try {
      const enabled = await audio.toggle();
      $("sound-button").setAttribute("aria-pressed", String(enabled));
      $("sound-button span").textContent = enabled ? "Sound on" : "Sound off";
      audio.update(car, 0, isPaused());
    } catch { announce("Sound is unavailable in this browser. The road is still yours."); }
    focusRoad();
  });
  document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => $(button.dataset.close).close()));
  for (const dialog of dialogs) {
    dialog.addEventListener("close", () => { syncInput(); focusRoad(); });
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
  $("rally-scene").addEventListener("webglcontextlost", event => {
    event.preventDefault(); stopped = true; syncInput();
    document.body.classList.add("has-error");
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
      const environment = { obstacles: landmarks, heightAt: driveHeightAt, supportAt: driveHeightAt, waterAt: riverAt };
      while (accumulator >= FIXED_STEP) {
        environment.onRoad = graphics.isRoad(car.x, car.z);
        stepCar(car, control, FIXED_STEP, environment);
        accumulator -= FIXED_STEP;
      }
      waterTime = car.inWater ? waterTime + dt : 0;
      if (waterTime > 0.75) {
        resetCar(car, lastSafePose); input.clear(); accumulator = 0; waterTime = 0;
        graphics.snapCamera(car); setNearby(null);
        announce("Splashed down. Back on the bank — keep some speed for the jump!");
      }
    } else accumulator = 0;
    graphics.render(car, paused && started ? 0 : dt, !paused, reducedMotion.matches);
    audio.update(car, control.throttle, paused);
    uiElapsed += dt;
    if (uiElapsed >= 0.075) {
      uiElapsed = 0;
      const speed = Math.round(car.speed * 3.6);
      if (lastSpeed !== speed) { $("speed").textContent = speed; lastSpeed = speed; }
      $("surface").textContent = car.inWater ? "SPLASH" : !car.grounded && car.airtime > 0.12 ? "AIRBORNE" : car.surface === "gravel" ? "GRAVEL" : "OFF ROAD";
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
    const cardBounds = $("nearby-card").hidden ? null : $("nearby-card").getBoundingClientRect();
    const labelVisible = projected => projected.visible && projected.x > 90 && projected.x < window.innerWidth - 90
      && projected.y > (smallScreen ? 96 : 112) && projected.y < window.innerHeight - (smallScreen ? 88 : 132)
      && !(cardBounds && projected.x < cardBounds.right + 100 && projected.y > cardBounds.top - 10 && projected.y < cardBounds.bottom + 40);
    landmarks.forEach((sight, index) => {
      const projected = graphics.project(sight.x, sight.type === "tower" ? 19 : sight.type === "arcade" ? 13 : 11, sight.z);
      labels[index].hidden = !labelVisible(projected);
      if (!labels[index].hidden) labels[index].style.transform = `translate(${Math.round(projected.x)}px, ${Math.round(projected.y)}px) translate(-50%, -100%)`;
    });
    crossingLabels.forEach(label => {
      const projected = graphics.project(label.x, label.y, label.z, true);
      label.element.hidden = !labelVisible(projected) || Math.hypot(car.x - label.x, car.z - label.z) > 95;
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
