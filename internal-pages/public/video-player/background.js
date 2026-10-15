'use strict';

/**
 * 视频播放器 - 后台脚本
 * 嗅探网页中的视频流地址（m3u8/mpd/mp4/flv），供内容脚本展示悬浮按钮，
 * 点击后在扩展自带的 ArtPlayer 页面中接管播放。
 */

// 播放列表/直链：只嗅 playlist 级别，不嗅分片（ts/m4s）
const VIDEO_RE = /\.(m3u8|mpd|mp4|flv|webm|m3u)(\?|#|$)/i;
// 常见分片后缀，命中则忽略（避免把分片当成可播放地址）
const SEGMENT_RE = /\.(ts|m4s|mpd\.seg)(\?|#|$)/i;

// tabId -> { url, title, time }
const tabVideos = new Map();

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return;
    const url = details.url || '';
    if (!VIDEO_RE.test(url) || SEGMENT_RE.test(url)) return;
    // 只保留主框架和子框架的请求，过滤 xhr 噪音？不，m3u8 本来就是 xhr 拉的，保留
    tabVideos.set(details.tabId, { url, time: Date.now() });
    browser.tabs.sendMessage(details.tabId, { type: 'video-detected', url }).catch(() => {});
  },
  { urls: ['<all_urls>'] }
);

// 标签关闭时清理
browser.tabs.onRemoved.addListener((tabId) => {
  tabVideos.delete(tabId);
});

browser.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || typeof msg !== 'object') return;

  // 内容脚本请求：本 tab 有没有嗅探到的视频
  if (msg.type === 'get-video') {
    const tabId = sender.tab && sender.tab.id;
    if (tabId == null || tabId < 0) return Promise.resolve(null);
    return Promise.resolve(tabVideos.get(tabId) || null);
  }

  // 打开播放器页
  if (msg.type === 'open-player' && typeof msg.url === 'string' && msg.url) {
    const playerUrl =
      browser.runtime.getURL('player.html') +
      '?url=' + encodeURIComponent(msg.url) +
      '&title=' + encodeURIComponent(msg.title || '视频播放');
    browser.tabs.create({ url: playerUrl });
    return Promise.resolve(true);
  }
});
