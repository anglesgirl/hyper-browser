'use strict';

const MOVY_ORIGIN = 'https://www.movy.sx';
const MOVY_REFERER = 'https://www.movy.sx/';

// noblekite.top / stormhive.top / moon.zenoak.top / *.zenoak.top
const HOST_RE = /(^|\.)(noblekite|stormhive|zenoak)\.(top|com|net|org|cc|xyz)$/i;

function setHeader(headers, name, value) {
  const lower = name.toLowerCase();
  const idx = headers.findIndex((h) => h.name && h.name.toLowerCase() === lower);
  if (idx >= 0) {
    headers[idx] = { name: name, value: value };
  } else {
    headers.push({ name: name, value: value });
  }
  return headers;
}

browser.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    let host;
    try {
      host = new URL(details.url).hostname;
    } catch (e) {
      return;
    }
    if (!HOST_RE.test(host)) return;
    const headers = (details.requestHeaders || []).slice();
    setHeader(headers, 'Origin', MOVY_ORIGIN);
    setHeader(headers, 'Referer', MOVY_REFERER);
    return { requestHeaders: headers };
  },
  { urls: ['<all_urls>'] },
  ['blocking', 'requestHeaders']
);
