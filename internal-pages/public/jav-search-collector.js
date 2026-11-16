(() => {
  const params = new URL(location.href).searchParams;
  const runId = params.get("__jav_search_id");
  const sourceId = params.get("__jav_search_source");
  if (!runId || !sourceId || !browser?.runtime?.sendMessage || window.top !== window) return;

  const TARGET = "hyper.javSearch.collect";
  const MAX_WAIT_MS = 9000;
  const STABLE_MS = 700;
  const CHALLENGE_SELECTORS = "#challenge-form, #cf-challenge-running, #cf-please-wait, .cf-browser-verification, #challenge-stage";
  const challengeWords = /just a moment|checking your browser|verify (?:that )?you are human|verifying you are human|performing security verification|驗證您是人類|验证您是真人|確認您是真人|正在驗證|正在验证|檢查您的瀏覽器|检查您的浏览器|セキュリティ確認/i;
  const blockedWords = /sorry,? you have been blocked|access denied|error (?:code )?10(?:20|15)|存取遭拒|存取被拒|訪問被拒|访问被拒|已被封鎖|已被封锁/i;
  const loginWords = /^(?:sign in|log ?in|登入|登錄|登录)(?:\s|$)|sign in to continue|login to continue|請先登入|请先登录|需要登入/i;
  let finished = false;

  function visible(element) {
    if (!(element instanceof Element) || !element.isConnected) return false;
    const style = getComputedStyle(element);
    return !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true" &&
      style.display !== "none" && style.visibility !== "hidden" && style.visibility !== "collapse" &&
      Number(style.opacity || 1) > 0 && element.getClientRects().length > 0;
  }

  function normalized(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function makeRegex(pattern, flags) {
    try { return new RegExp(pattern, flags || ""); } catch { return null; }
  }

  function matchingNodes(selectors) {
    const nodes = [];
    for (const selector of selectors || []) {
      try { nodes.push(...document.querySelectorAll(selector)); } catch { /* Registered selectors are source data. */ }
    }
    return [...new Set(nodes)];
  }

  function resultAnchors(rules) {
    return matchingNodes(rules.linkSelectors).filter((node) => node instanceof HTMLAnchorElement);
  }

  function collectItems(rules) {
    const detailPath = makeRegex(rules.detailPathPattern, rules.detailPathFlags);
    if (!detailPath) return [];
    const anchors = resultAnchors(rules);
    const cardSelectors = (rules.cardSelectors || []).join(",");
    const seen = new Set();
    const results = [];

    for (const anchor of anchors) {
      if (results.length >= 30 || !visible(anchor)) continue;
      let url;
      try { url = new URL(anchor.href, location.href); } catch { continue; }
      if (url.protocol !== "https:" || location.protocol !== "https:" || url.origin !== location.origin ||
          !detailPath.test(url.pathname) || seen.has(url.href)) continue;

      let card = null;
      if (cardSelectors) {
        try { card = anchor.closest(cardSelectors); } catch { card = null; }
      }
      const headerFooter = anchor.closest("header, footer");
      const inChrome = !!anchor.closest("nav, .advertisement") || !!(headerFooter && (!card || headerFooter.contains(card)));
      if (inChrome) continue;

      const titleNode = card?.querySelector(".title, .video-title, .video-name, .content-title, h2, h3, h4");
      const anchorImage = anchor.querySelector("img[alt]");
      const cardImage = card?.querySelector("img[alt]");
      const title = normalized(anchor.getAttribute("title")) ||
        normalized(titleNode?.innerText || titleNode?.textContent) ||
        normalized(anchorImage?.getAttribute("alt")) ||
        normalized(cardImage?.getAttribute("alt")) ||
        normalized(anchor.innerText || anchor.textContent);
      if (!title) continue;

      const image = card?.querySelector("img") || anchor.querySelector("img");
      let coverUrl = "";
      for (const attribute of ["data-src", "data-original", "src"]) {
        const value = image?.getAttribute(attribute);
        if (!value) continue;
        try {
          const candidate = new URL(value, location.href);
          if ((candidate.protocol === "https:" || candidate.protocol === "http:") && !candidate.username && !candidate.password) {
            coverUrl = candidate.href;
            break;
          }
        } catch { /* Ignore malformed image URLs. */ }
      }
      if (!coverUrl) {
        const styled = card?.querySelector(".videoBox-cover[style]");
        const value = styled && /url\(['"]?([^)'\"]+)/i.exec(styled.getAttribute("style") || "")?.[1];
        if (value) {
          try { coverUrl = new URL(value, location.href).href; } catch { /* No usable cover. */ }
        }
      }

      const code = (rules.codeSelectors || []).map((selector) => {
        try { return normalized(card?.querySelector(selector)?.innerText || card?.querySelector(selector)?.textContent); }
        catch { return ""; }
      }).find(Boolean) || "";
      const evidence = `${title} ${url.href}`;
      const variantTags = [];
      if (evidence.includes("中文字幕") || evidence.includes("中文")) variantTags.push("中文字幕");
      if (/uncensored/i.test(evidence) || evidence.includes("無碼")) variantTags.push("無碼");
      if (/(?<![a-z0-9])4k(?![a-z0-9])/i.test(evidence)) variantTags.push("4K");

      seen.add(url.href);
      results.push({ title: title.slice(0, 240), url: url.href, code, coverUrl, variantTags });
    }
    return results;
  }

  function emptySignal(rules) {
    const emptyText = makeRegex(rules.emptyTextPattern, rules.emptyTextFlags);
    const exactTexts = new Set(rules.emptyExactTexts || []);
    const cardSelectors = (rules.cardSelectors || []).join(",");
    const eligible = (node) => {
      if (!visible(node) || node.closest("nav, header, footer, .comments, #comments, .recommendations, .related, .related-videos")) return false;
      if (cardSelectors) {
        try { if (node.closest(cardSelectors)) return false; } catch { /* Ignore malformed source selector. */ }
      }
      return true;
    };
    const emptyTextMatches = (node, limit) => {
      const text = normalized(node.innerText || node.textContent);
      return text.length <= limit && (exactTexts.has(text) || !!emptyText?.test(text));
    };
    if (matchingNodes(rules.emptySelectors).some((node) => eligible(node) && emptyTextMatches(node, 500))) return true;
    return matchingNodes(["main h1", "main h2", "[role=main] h1", "[role=main] h2", ".search-results h1", ".search-results h2"])
      .some((node) => eligible(node) && emptyTextMatches(node, 200));
  }

  function pageIsBlocked(hasResultCards) {
    const title = normalized(document.title);
    const heading = `${title} ${normalized([...document.querySelectorAll("h1, h2, [role=heading]")].filter(visible).map((node) => node.textContent).join(" "))}`;
    const visibleText = normalized(document.body?.innerText).slice(0, 10000);
    const cfDom = matchingNodes(["#cf-error-details", "#cf-wrapper", ".cf-error-details"]).some(visible);
    const cfScript = [...document.scripts].some((script) => script.textContent?.includes("_cf_chl_opt") ||
      (script.src.includes("/cdn-cgi/challenge-platform/") && script.src.includes("/orchestrate/")));
    const interstitial = matchingNodes([CHALLENGE_SELECTORS]).some(visible);
    if (!hasResultCards && cfDom && blockedWords.test(visibleText)) return true;
    if (interstitial && (!hasResultCards || challengeWords.test(heading))) return true;
    if (!hasResultCards && challengeWords.test(`${heading} ${visibleText}`)) return true;
    if (!hasResultCards && cfScript && matchingNodes(["#challenge-running"]).some(visible)) return true;
    const loginPath = /\/(?:login|signin|auth)(?:\/|$)/i.test(location.pathname);
    const passwordGate = !!document.querySelector("input[type='password']") && /\b(log ?in|sign ?in|登录)\b/i.test(`${heading} ${visibleText}`);
    if (loginPath || passwordGate || (!hasResultCards && loginWords.test(`${heading} ${visibleText}`.trim()))) return true;
    return false;
  }

  function observeReady(rules) {
    return new Promise((resolve) => {
      let lastMutation = Date.now();
      const started = Date.now();
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        observer.disconnect();
        clearInterval(poll);
        clearTimeout(timeout);
        resolve();
      };
      const check = () => {
        const items = collectItems(rules);
        if (pageIsBlocked(items.length > 0) || emptySignal(rules) || items.length > 0) {
          if (Date.now() - lastMutation >= STABLE_MS || Date.now() - started >= MAX_WAIT_MS) finish();
        }
      };
      const observer = new MutationObserver(() => { lastMutation = Date.now(); check(); });
      observer.observe(document.documentElement || document, { childList: true, subtree: true, attributes: true, characterData: true });
      const poll = setInterval(check, 200);
      const timeout = setTimeout(finish, MAX_WAIT_MS);
      check();
    });
  }

  function report(status, items) {
    if (finished) return;
    finished = true;
    browser.runtime.sendMessage({ target: TARGET, id: runId, sourceId, status, items }).then((response) => {
      const next = response && response.ok && response.data && response.data.nextUrl;
      if (typeof next === "string" && next) location.replace(next);
    }).catch(() => undefined);
  }

  browser.runtime.sendMessage({ target: TARGET, action: "rules", id: runId, sourceId }).then(async (response) => {
    const rules = response && response.ok && response.data;
    if (!rules || rules.sourceId !== sourceId || location.protocol !== "https:") return;
    await observeReady(rules);
    const items = collectItems(rules);
    if (pageIsBlocked(items.length > 0)) return report("blocked", []);
    if (items.length) return report("results", items);
    if (emptySignal(rules)) return report("empty", []);
    report("unsupported", []);
  }).catch(() => undefined);
})();
