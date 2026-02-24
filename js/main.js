/* ============================================
   Scroll Reveal & Interactions
   ============================================ */

(function () {
  "use strict";

  // ============================================
  // Scroll Reveal Observer
  // ============================================

  const REVEAL_SELECTORS =
    ".reveal, .reveal-left, .reveal-right, .reveal-scale, .separator";
  const REVEAL_OPTIONS = {
    root: null,
    rootMargin: "0px 0px -60px 0px",
    threshold: 0.1,
  };

  function initScrollReveal() {
    var elements = document.querySelectorAll(REVEAL_SELECTORS);

    if (!elements.length) return;

    if (!("IntersectionObserver" in window)) {
      elements.forEach(function (el) {
        el.classList.add("visible");
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, REVEAL_OPTIONS);

    elements.forEach(function (el) {
      observer.observe(el);
    });
  }

  // Exposed so renderer.js can re-trigger after DOM injection
  window.__initScrollReveal = initScrollReveal;

  // ============================================
  // Smooth Scroll for Anchor Links
  // ============================================

  function initSmoothScroll() {
    document.addEventListener("click", function (e) {
      var anchor = e.target.closest('a[href^="#"]');
      if (!anchor) return;

      var targetId = anchor.getAttribute("href");
      if (targetId === "#") return;

      var target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // ============================================
  // Download Button Click Tracking
  // ============================================

  function initDownloadTracking() {
    var downloadBtn = document.querySelector(".btn-download");
    if (!downloadBtn) return;

    downloadBtn.addEventListener("click", function () {
      // Minor visual feedback
      downloadBtn.style.transform = "scale(0.96)";
      setTimeout(function () {
        downloadBtn.style.transform = "";
      }, 150);
    });
  }

  // ============================================
  // Skill Tag Accent Color Rotation on Hover
  // ============================================

  var TAG_COLORS = [
    "#61afef", // blue
    "#c678dd", // magenta
    "#98c379", // green
    "#e5c07b", // yellow
    "#56b6c2", // cyan
    "#e06c75", // red
    "#d19a66", // orange
  ];

  function initSkillTagColors() {
    var tags = document.querySelectorAll(".skill-tag");
    tags.forEach(function (tag) {
      var color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
      tag.addEventListener("mouseenter", function () {
        tag.style.backgroundColor = color;
        tag.style.borderColor = color;
        tag.style.color = "#282c34";
      });
      tag.addEventListener("mouseleave", function () {
        tag.style.backgroundColor = "";
        tag.style.borderColor = "";
        tag.style.color = "";
      });
    });
  }

  // ============================================
  // External Link Safety
  // ============================================

  function initExternalLinks() {
    var links = document.querySelectorAll('a[target="_blank"]');
    links.forEach(function (link) {
      if (!link.getAttribute("rel")) {
        link.setAttribute("rel", "noopener noreferrer");
      }
    });
  }

  // ============================================
  // Init Everything on DOM Ready
  // ============================================

  function init() {
    // renderer.js populates the DOM first, then calls __initScrollReveal itself.
    // We still call the rest of the interactions here — they're event-delegated
    // or safe to run before content is injected.
    initSmoothScroll();
    initDownloadTracking();
    initSkillTagColors();
    initExternalLinks();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
