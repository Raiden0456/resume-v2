/* ============================================
   Resume Renderer — builds DOM from resume.json
   ============================================ */

(function () {
  "use strict";

  // ============================================
  // Helpers
  // ============================================

  function el(tag, attrs, ...children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === "className") {
          node.className = attrs[key];
        } else if (key === "html") {
          node.innerHTML = attrs[key];
        } else {
          node.setAttribute(key, attrs[key]);
        }
      });
    }
    children.forEach(function (child) {
      if (!child) return;
      if (typeof child === "string") {
        node.appendChild(document.createTextNode(child));
      } else {
        node.appendChild(child);
      }
    });
    return node;
  }

  function icon(name) {
    return el("i", { "data-lucide": name });
  }

  function skillTag(text) {
    return el(
      "span",
      { className: "skill-tag", "data-tech": text.toLowerCase() },
      text,
    );
  }

  function separator() {
    var div = el("div", { className: "separator", "aria-hidden": "true" });
    return div;
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ============================================
  // Section builders
  // ============================================

  function buildHero(data) {
    var personal = data.personal;
    var contact = data.contact;
    var links = data.links;

    // Header
    var header = document.querySelector(".hero-section");
    if (header) {
      var info = header.querySelector(".hero-info");
      if (info) {
        info.querySelector(".hero-name").textContent = personal.name;
        info.querySelector(".hero-title").textContent = personal.title;
        info.querySelector(".hero-location span").textContent =
          personal.location;
      }
    }

    // Contact row
    var contactRow = document.querySelector(".hero-contact");
    if (contactRow) {
      contactRow.innerHTML = "";

      var emailLink = el(
        "a",
        {
          href: "mailto:" + contact.email,
          className: "contact-item",
          "aria-label": "Email",
        },
        icon("mail"),
        el("span", null, contact.email),
      );
      contactRow.appendChild(emailLink);

      var phoneLink = el(
        "a",
        {
          href: "tel:" + contact.phone.replace(/\s/g, ""),
          className: "contact-item",
          "aria-label": "Phone",
        },
        icon("phone"),
        el("span", null, contact.phone),
      );
      contactRow.appendChild(phoneLink);

      if (contact.whatsapp) {
        var waLink = el(
          "a",
          {
            href: contact.whatsapp.href,
            className: "contact-item",
            target: "_blank",
            rel: "noopener noreferrer",
            "aria-label": "WhatsApp",
          },
          icon("message-circle"),
          el("span", null, contact.whatsapp.display),
        );
        contactRow.appendChild(waLink);
      }
    }

    // Actions row
    var actionsRow = document.querySelector(".hero-actions");
    if (actionsRow) {
      actionsRow.innerHTML = "";

      if (data.pdf) {
        var dlBtn = el(
          "a",
          {
            href: data.pdf,
            download: "",
            className: "btn-download",
            "aria-label": "Download resume as PDF",
          },
          icon("download"),
          el("span", null, "Download PDF"),
        );
        actionsRow.appendChild(dlBtn);
      }

      var nav = el("nav", {
        className: "social-links",
        "aria-label": "Social links",
      });

      var socialDefs = [
        { key: "github", iconName: "github", label: "GitHub" },
        { key: "linkedin", iconName: "linkedin", label: "LinkedIn" },
        { key: "telegram", iconName: "send", label: "Telegram" },
      ];

      socialDefs.forEach(function (def) {
        if (!links[def.key]) return;
        var a = el(
          "a",
          {
            href: links[def.key],
            className: "social-link",
            target: "_blank",
            rel: "noopener noreferrer",
            title: def.label,
            "aria-label": def.label,
          },
          icon(def.iconName),
        );
        nav.appendChild(a);
      });

      actionsRow.appendChild(nav);
    }
  }

  function buildProfile(profile) {
    var section = document.querySelector("#profile");
    if (!section) return;
    var p = section.querySelector(".profile-text");
    if (p) p.textContent = profile;
  }

  function buildHighlights(highlights) {
    var list = document.querySelector("#highlights .highlights-list");
    if (!list) return;
    list.innerHTML = "";
    highlights.forEach(function (text) {
      var item = el("div", { className: "highlight-item reveal" }, text);
      list.appendChild(item);
    });
  }

  function buildTechStack(techStack) {
    var grid = document.querySelector("#tech-stack .tech-stack-grid");
    if (!grid) return;
    grid.innerHTML = "";
    Object.keys(techStack).forEach(function (category) {
      var items = techStack[category];
      var itemsWrap = el("div", { className: "tech-category-items" });
      items.forEach(function (item) {
        itemsWrap.appendChild(skillTag(item));
      });
      var card = el(
        "div",
        { className: "tech-category reveal" },
        el("div", { className: "tech-category-label" }, category),
        itemsWrap,
      );
      grid.appendChild(card);
    });
  }

  function buildExperience(experience) {
    var list = document.querySelector("#experience .jobs-list");
    if (!list) return;
    list.innerHTML = "";

    experience.forEach(function (job) {
      var article = el("article", {
        className: "job-card reveal",
        "aria-label": job.company + " position",
      });

      // Header
      var companyNode;
      if (job.companyUrl) {
        companyNode = el(
          "p",
          { className: "job-company" },
          el(
            "a",
            {
              href: job.companyUrl,
              target: "_blank",
              rel: "noopener noreferrer",
            },
            job.company,
          ),
          " — " + job.location,
        );
      } else {
        var companyText = job.company + " — " + job.location;
        if (job.type && job.type !== "full-time") {
          companyText += " · " + job.type;
        }
        companyNode = el("p", { className: "job-company" }, companyText);
      }

      article.appendChild(
        el(
          "div",
          { className: "job-header" },
          el("h3", { className: "job-role" }, job.role),
          companyNode,
        ),
      );

      // Meta
      var meta = el("div", { className: "job-meta" });
      meta.appendChild(
        el(
          "span",
          { className: "job-meta-item" },
          icon("calendar"),
          " " + job.period,
        ),
      );
      meta.appendChild(
        el(
          "span",
          { className: "job-meta-item" },
          icon("map-pin"),
          " " + job.location,
        ),
      );
      article.appendChild(meta);

      // Project
      if (job.project) {
        var projContent = document.createElement("div");
        projContent.className = "job-project";
        var projHTML =
          "<strong>" +
          escapeHTML(job.project.name) +
          "</strong> — " +
          escapeHTML(job.project.description);
        if (job.project.url) {
          projHTML +=
            '<br><a href="' +
            escapeHTML(job.project.url) +
            '" target="_blank" rel="noopener noreferrer">' +
            escapeHTML(job.project.url.replace(/^https?:\/\//, "")) +
            "</a>";
        }
        projContent.innerHTML = projHTML;
        article.appendChild(projContent);
      }

      // Stack
      if (job.stack && job.stack.length) {
        var stackWrap = el("div", { className: "job-tech-stack" });
        job.stack.forEach(function (tech) {
          stackWrap.appendChild(skillTag(tech));
        });
        article.appendChild(stackWrap);
      }

      // Subsections
      if (job.subsections && job.subsections.length) {
        job.subsections.forEach(function (sub) {
          var detailsWrap = el("div", { className: "job-details" });
          sub.items.forEach(function (text) {
            var cls =
              "job-detail-item" +
              (sub.style === "results" ? " result-item" : "");
            detailsWrap.appendChild(el("div", { className: cls }, text));
          });

          if (sub.title) {
            var subsection = el(
              "div",
              { className: "job-subsection" },
              el("div", { className: "job-subsection-title" }, sub.title),
              detailsWrap,
            );
            article.appendChild(subsection);
          } else {
            article.appendChild(detailsWrap);
          }
        });
      }

      list.appendChild(article);
    });
  }

  function buildSkills(skills) {
    var grid = document.querySelector("#skills .skills-grid");
    if (!grid) return;
    grid.innerHTML = "";
    skills.forEach(function (skill) {
      grid.appendChild(skillTag(skill));
    });
  }

  function buildLanguages(languages) {
    var list = document.querySelector("#languages .languages-list");
    if (!list) return;
    list.innerHTML = "";
    languages.forEach(function (lang) {
      list.appendChild(
        el(
          "div",
          { className: "language-item" },
          el("span", { className: "language-name" }, lang.name),
          el("span", { className: "language-level" }, "— " + lang.level),
        ),
      );
    });
  }

  function buildEducation(education) {
    var list = document.querySelector("#education .education-list");
    if (!list) return;
    list.innerHTML = "";
    education.forEach(function (edu) {
      var card = el(
        "div",
        { className: "education-card reveal" },
        el("h3", { className: "education-degree" }, edu.degree),
        el("p", { className: "education-school" }, edu.institution),
        el(
          "p",
          { className: "education-dates" },
          icon("calendar"),
          " " + edu.period,
        ),
      );
      if (edu.description) {
        card.appendChild(
          el("p", { className: "education-description" }, edu.description),
        );
      }
      list.appendChild(card);
    });
  }

  function buildCourses(courses) {
    var list = document.querySelector("#courses .courses-list");
    if (!list) return;
    list.innerHTML = "";
    courses.forEach(function (course) {
      var card = el(
        "div",
        { className: "course-card reveal" },
        el("h3", { className: "course-name" }, course.name),
        el("p", { className: "course-institution" }, course.institution),
        el(
          "p",
          { className: "course-dates" },
          icon("calendar"),
          " " + course.period,
        ),
      );

      if (course.items && course.items.length) {
        var details = el("div", {
          className: "course-description course-details",
        });
        var jobDetails = el("div", { className: "job-details" });
        course.items.forEach(function (item) {
          jobDetails.appendChild(
            el("div", { className: "job-detail-item" }, item),
          );
        });
        details.appendChild(jobDetails);
        card.appendChild(details);
      } else if (course.description) {
        card.appendChild(
          el("p", { className: "course-description" }, course.description),
        );
      }

      list.appendChild(card);
    });
  }

  // ============================================
  // Main render
  // ============================================

  function render(data) {
    buildHero(data);
    buildProfile(data.profile);
    buildHighlights(data.highlights);
    buildTechStack(data.techStack);
    buildExperience(data.experience);
    buildSkills(data.skills);
    buildLanguages(data.languages);
    buildEducation(data.education);
    buildCourses(data.courses);

    // Re-initialize Lucide icons after DOM injection
    if (window.lucide) {
      window.lucide.createIcons();
    }

    // Kick off scroll reveal after render
    if (window.__initScrollReveal) {
      window.__initScrollReveal();
    }
  }

  // ============================================
  // Fetch & bootstrap
  // ============================================

  function init() {
    fetch("resume.json")
      .then(function (res) {
        if (!res.ok)
          throw new Error("Failed to load resume.json: " + res.status);
        return res.json();
      })
      .then(render)
      .catch(function (err) {
        console.error("[renderer]", err);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
