// AO3 Reader 内置扩展 background —— 负责跨域网络请求（GM_xmlhttpRequest 转发）
// 背景脚本不受页面同源策略限制，配合 manifest host permissions 可访问任意翻译 API
(() => {
  const TAG = "[ao3-zh-bg]";

  function doFetch(msg) {
    const { url, method, headers, data, timeout } = msg;
    const controller = new AbortController();
    const timer = timeout ? setTimeout(() => controller.abort(), timeout) : null;
    return fetch(url, {
      method: method || "GET",
      headers: headers || {},
      body: data || (method && method.toUpperCase() !== "GET" ? undefined : undefined),
      signal: controller.signal,
    }).then(async (r) => {
      const text = await r.text();
      const headersStr = {};
      r.headers.forEach((v, k) => (headersStr[k] = v));
      return {
        status: r.status,
        statusText: r.statusText,
        responseText: text,
        responseHeaders: JSON.stringify(headersStr),
        readyState: 4,
        finalUrl: r.url,
      };
    });
  }

  if (typeof browser !== "undefined" && browser.runtime && browser.runtime.onMessage) {
    browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      // 主页"最近作品"拉取：hyper://home 请求 AO3 页面 HTML（跨域，走扩展权限）
      if (msg && msg.type === "ao3.fetchHtml" && msg.url) {
        doFetch({
          url: msg.url,
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
          },
          timeout: 20000,
        })
          .then((resp) =>
            resp.status >= 200 && resp.status < 300
              ? sendResponse({ ok: true, data: resp.responseText })
              : sendResponse({ ok: false, error: "HTTP " + resp.status })
          )
          .catch((err) => sendResponse({ ok: false, error: String((err && err.name) || err || "network") }));
        return true;
      }
      if (!msg || msg.type !== "GM_xmlhttpRequest" || !msg.url) {
        sendResponse({ error: "bad_message", readyState: 0 });
        return;
      }
      doFetch(msg)
        .then((resp) => sendResponse(resp))
        .catch((err) =>
          sendResponse({
            error: String((err && err.name) || err || "network"),
            status: 0,
            responseText: "",
            readyState: 0,
          })
        );
      return true; // 异步 sendResponse
    });
    console.log(TAG, "listener ready");
  } else {
    console.warn(TAG, "browser.runtime unavailable");
  }
})();
