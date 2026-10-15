'use strict';

/**
 * 视频播放器 - 内容脚本
 * 在检测到可播放视频时注入悬浮按钮，点击后交由扩展的 ArtPlayer 页面接管播放。
 */

const BTN_ID = '__hyper_video_player_btn__';
let currentUrl = null;

function ensureButton(url) {
  currentUrl = url;
  if (document.getElementById(BTN_ID)) return;
  if (!document.body) return;

  const btn = document.createElement('div');
  btn.id = BTN_ID;
  btn.textContent = '🎬 播放器打开';
  btn.style.cssText = [
    'position:fixed',
    'right:12px',
    'bottom:88px',
    'z-index:2147483647',
    'background:rgba(20,20,24,.88)',
    'color:#fff',
    'font-size:13px',
    'line-height:1',
    'padding:10px 14px',
    'border-radius:20px',
    'cursor:pointer',
    'user-select:none',
    '-webkit-user-select:none',
    'box-shadow:0 2px 10px rgba(0,0,0,.4)',
    'font-family:system-ui,sans-serif',
  ].join(';');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentUrl) return;
    browser.runtime.sendMessage({
      type: 'open-player',
      url: currentUrl,
      title: document.title || '视频播放',
    });
  });

  // 长按隐藏（避免遮挡）
  let pressTimer = null;
  btn.addEventListener('touchstart', () => {
    pressTimer = setTimeout(() => btn.remove(), 600);
  }, { passive: true });
  btn.addEventListener('touchend', () => {
    if (pressTimer) clearTimeout(pressTimer);
  });

  document.body.appendChild(btn);
}

// 后台嗅探到的地址
browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'video-detected' && msg.url) {
    ensureButton(msg.url);
  }
});

// 自家站点配合输出：2BTV 等检测到 HyperBrowser UA 后，直接在页面里输出视频地址
// <meta name="hyper-video-url" content="https://...m3u8">
function checkSiteCooperation() {
  const meta = document.querySelector('meta[name="hyper-video-url"]');
  const url = meta && meta.getAttribute('content');
  if (url && /^https?:/i.test(url)) {
    ensureButton(url.trim());
    return true;
  }
  return false;
}

// 直接找页面里的 <video>（兜底：有些站地址直接写在标签上）
function scanVideoTags() {
  if (checkSiteCooperation()) return;
  const v = document.querySelector('video[src], video > source[src]');
  const url = v && (v.src || (v.querySelector('source') || {}).src);
  if (url && /^https?:/i.test(url)) ensureButton(url);
}

// 启动时先问后台有没有已嗅探到的地址（应对 content script 后加载的情况）
browser.runtime.sendMessage({ type: 'get-video' }).then((found) => {
  if (found && found.url) ensureButton(found.url);
  else scanVideoTags();
}).catch(() => scanVideoTags());

// SPA 页面：DOM 变化时再扫一遍 video 标签
let scanQueued = false;
new MutationObserver(() => {
  if (scanQueued) return;
  scanQueued = true;
  setTimeout(() => {
    scanQueued = false;
    if (!document.getElementById(BTN_ID)) scanVideoTags();
  }, 1500);
}).observe(document.documentElement, { childList: true, subtree: true });
