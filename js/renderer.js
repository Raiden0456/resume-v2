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

  function brandIcon(name) {
    var svgs = {
      github:
        '<svg role="img" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>',
      linkedin:
        '<svg role="img" viewBox="0 0 382 382" width="24" height="24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M347.445,0H34.555C15.471,0,0,15.471,0,34.555v312.889C0,366.529,15.471,382,34.555,382h312.889C366.529,382,382,366.529,382,347.444V34.555C382,15.471,366.529,0,347.445,0z M118.207,329.844c0,5.554-4.502,10.056-10.056,10.056H65.345c-5.554,0-10.056-4.502-10.056-10.056V150.403c0-5.554,4.502-10.056,10.056-10.056h42.806c5.554,0,10.056,4.502,10.056,10.056V329.844z M86.748,123.432c-22.459,0-40.666-18.207-40.666-40.666S64.289,42.1,86.748,42.1s40.666,18.207,40.666,40.666S109.208,123.432,86.748,123.432z M341.91,330.654c0,5.106-4.14,9.246-9.246,9.246H286.73c-5.106,0-9.246-4.14-9.246-9.246v-84.168c0-12.556,3.683-55.021-32.813-55.021c-28.309,0-34.051,29.066-35.204,42.11v97.079c0,5.106-4.139,9.246-9.246,9.246h-44.426c-5.106,0-9.246-4.14-9.246-9.246V149.593c0-5.106,4.14-9.246,9.246-9.246h44.426c5.106,0,9.246,4.14,9.246,9.246v15.655c10.497-15.753,26.097-27.912,59.312-27.912c73.552,0,73.131,68.716,73.131,106.472L341.91,330.654L341.91,330.654z"/></svg>',
      telegram:
        '<svg role="img" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M23.1117 4.49449C23.4296 2.94472 21.9074 1.65683 20.4317 2.227L2.3425 9.21601C0.694517 9.85273 0.621087 12.1572 2.22518 12.8975L6.1645 14.7157L8.03849 21.2746C8.13583 21.6153 8.40618 21.8791 8.74917 21.968C9.09216 22.0568 9.45658 21.9576 9.70712 21.707L12.5938 18.8203L16.6375 21.8531C17.8113 22.7334 19.5019 22.0922 19.7967 20.6549L23.1117 4.49449ZM3.0633 11.0816L21.1525 4.0926L17.8375 20.2531L13.1 16.6999C12.7019 16.4013 12.1448 16.4409 11.7929 16.7928L10.5565 18.0292L10.928 15.9861L18.2071 8.70703C18.5614 8.35278 18.5988 7.79106 18.2947 7.39293C17.9906 6.99479 17.4389 6.88312 17.0039 7.13168L6.95124 12.876L3.0633 11.0816ZM8.17695 14.4791L8.78333 16.6015L9.01614 15.321C9.05253 15.1209 9.14908 14.9366 9.29291 14.7928L11.5128 12.573L8.17695 14.4791Z"/></svg>',
    };
    var wrapper = document.createElement("div");
    wrapper.innerHTML = svgs[name] || "";
    return wrapper.firstChild;
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
        { key: "github", iconName: "github", label: "GitHub", brand: true },
        {
          key: "linkedin",
          iconName: "linkedin",
          label: "LinkedIn",
          brand: true,
        },
        {
          key: "telegram",
          iconName: "telegram",
          label: "Telegram",
          brand: true,
        },
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
          def.brand ? brandIcon(def.iconName) : icon(def.iconName),
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
      var companySuffix =
        job.type && job.type !== "full-time" ? " · " + job.type : "";
      if (job.companyUrl) {
        companyNode = el(
          "p",
          { className: "job-company" },
          el(
            "a",
            {
              href: job.companyUrl,
              className: "company-link",
              target: "_blank",
              rel: "noopener noreferrer",
            },
            job.company,
          ),
          companySuffix,
        );
      } else {
        companyNode = el(
          "p",
          { className: "job-company" },
          job.company + companySuffix,
        );
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

      // Projects (multi-project) or legacy single project
      var projects = job.projects
        ? job.projects
        : job.project
          ? [job.project]
          : [];

      projects.forEach(function (proj, idx) {
        var isMulti = projects.length > 1;

        // Project header
        var projContent = document.createElement("div");
        projContent.className =
          "job-project" + (isMulti ? " job-project--multi" : "");
        var projHTML =
          "<strong>" +
          escapeHTML(proj.name) +
          "</strong> — " +
          escapeHTML(proj.description);
        if (proj.url) {
          projHTML +=
            '<br><a href="' +
            escapeHTML(proj.url) +
            '" target="_blank" rel="noopener noreferrer">' +
            escapeHTML(proj.url.replace(/^https?:\/\//, "")) +
            "</a>";
        }
        projContent.innerHTML = projHTML;
        article.appendChild(projContent);

        // Per-project stack
        var stack = proj.stack || (idx === 0 ? job.stack : null);
        if (stack && stack.length) {
          var stackWrap = el("div", { className: "job-tech-stack" });
          stack.forEach(function (tech) {
            stackWrap.appendChild(skillTag(tech));
          });
          article.appendChild(stackWrap);
        }

        // Per-project subsections
        var subsections =
          proj.subsections || (idx === 0 ? job.subsections : null);
        if (subsections && subsections.length) {
          subsections.forEach(function (sub) {
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

        // Divider between projects
        if (isMulti && idx < projects.length - 1) {
          article.appendChild(el("hr", { className: "job-project-divider" }));
        }
      });

      // Top-level stack fallback (jobs with no projects at all)
      if (!projects.length) {
        if (job.stack && job.stack.length) {
          var stackWrap = el("div", { className: "job-tech-stack" });
          job.stack.forEach(function (tech) {
            stackWrap.appendChild(skillTag(tech));
          });
          article.appendChild(stackWrap);
        }

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
    // Lucide script is deferred, so it may not be ready yet
    function initLucide() {
      if (window.lucide) {
        window.lucide.createIcons();
      } else {
        document.addEventListener("DOMContentLoaded", function () {
          if (window.lucide) window.lucide.createIcons();
        });
      }
    }
    initLucide();

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
