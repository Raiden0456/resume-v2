const showError = error => {
  console.error("Résumé Rally:", error);
  document.body.classList.remove("is-loading");
  document.body.classList.add("has-error");
  document.getElementById("loading").hidden = true;
  document.getElementById("intro").hidden = true;
  document.getElementById("error-panel").hidden = false;
  document.getElementById("retry-button").onclick = () => window.location.reload();
};

import("./main.js").then(module => module.start()).catch(showError);
