/* AO3 Reader - content script
 * Injects a floating "阅读模式" button on AO3 chapter pages.
 * Clicking opens a clean reading overlay.
 */
(function () {
  "use strict";

  if (!/\/works\/\d+/.test(window.location.pathname)) return;
  if (document.getElementById("ao3-reader-btn")) return;

  var MIN_CHARS = 200;

  function getChapterContent() {
    var chaptersEl = document.querySelector("#chapters");
    if (!chaptersEl) return null;
    var blocks = chaptersEl.querySelectorAll(".userstuff");
    if (!blocks.length) return null;
    var container = document.createElement("div");
    blocks.forEach(function (el) {
      var clone = el.cloneNode(true);
      clone.querySelectorAll(".kudos,.comments,.navigation,.actions,script,style").forEach(function (n) { n.remove(); });
      container.appendChild(clone);
    });
    var text = (container.textContent || "").trim();
    if (text.length < MIN_CHARS) return null;
    return container.innerHTML;
  }

  function getTitle() {
    var h = document.querySelector(".chapter .heading, #chapters .heading");
    if (h && h.textContent.trim()) return h.textContent.trim();
    var w = document.querySelector("h2.title.heading");
    if (w && w.textContent.trim()) return w.textContent.trim();
    return document.title;
  }

  function getAuthor() {
    var a = document.querySelector('a[rel="author"]');
    return a ? a.textContent.trim() : "";
  }

  function openReader() {
    var html = getChapterContent();
    if (!html) {
      alert("未找到章节正文");
      return;
    }
    closeReader();

    var overlay = document.createElement("div");
    overlay.id = "ao3-reader-overlay";

    var bar = document.createElement("div");
    bar.id = "ao3-reader-bar";

    var titleEl = document.createElement("span");
    titleEl.id = "ao3-reader-title";
    titleEl.textContent = getTitle();
    var author = getAuthor();
    if (author) titleEl.textContent += " — " + author;

    var controls = document.createElement("div");
    controls.id = "ao3-reader-controls";

    function mkBtn(label, fn, title) {
      var b = document.createElement("button");
      b.textContent = label;
      b.title = title || label;
      b.onclick = fn;
      return b;
    }

    var themes = ["light", "sepia", "dark"];
    var themeIdx = 0;
    var fontSize = 19;

    function applyTheme() {
      overlay.dataset.theme = themes[themeIdx];
    }
    function applyFont() {
      overlay.style.setProperty("--ao3r-font-size", fontSize + "px");
    }

    controls.appendChild(mkBtn("A-", function () {
      fontSize = Math.max(14, fontSize - 1); applyFont();
    }, "减小字号"));
    controls.appendChild(mkBtn("A+", function () {
      fontSize = Math.min(28, fontSize + 1); applyFont();
    }, "增大字号"));
    controls.appendChild(mkBtn("主题", function () {
      themeIdx = (themeIdx + 1) % themes.length; applyTheme();
    }, "切换主题"));
    controls.appendChild(mkBtn("✕", closeReader, "关闭"));

    bar.appendChild(titleEl);
    bar.appendChild(controls);

    var body = document.createElement("div");
    body.id = "ao3-reader-body";
    body.innerHTML = html;

    overlay.appendChild(bar);
    overlay.appendChild(body);
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    applyTheme();
    applyFont();
    body.scrollTop = 0;
  }

  function closeReader() {
    var o = document.getElementById("ao3-reader-overlay");
    if (o) o.remove();
    document.body.style.overflow = "";
  }

  // Floating button
  var btn = document.createElement("button");
  btn.id = "ao3-reader-btn";
  btn.textContent = "阅读模式";
  btn.onclick = openReader;
  document.body.appendChild(btn);

  // Keyboard shortcut: Alt+R toggles
  document.addEventListener("keydown", function (e) {
    if (e.altKey && (e.key === "r" || e.key === "R")) {
      e.preventDefault();
      if (document.getElementById("ao3-reader-overlay")) closeReader();
      else openReader();
    }
  });
})();
