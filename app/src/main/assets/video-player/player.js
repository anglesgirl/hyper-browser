(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  var url = params.get('url') || '';
  var title = params.get('title') || '视频播放';
  document.title = title;

  function fail(msg) {
    var el = document.getElementById('err');
    el.style.display = 'block';
    el.textContent = msg;
  }

  if (!url) { fail('没有可播放的地址'); return; }

  // 诊断信息：检查关键库是否加载
  if (typeof Artplayer === 'undefined') { fail('Artplayer 未加载 (artplayer.js 404?)'); return; }
  if (typeof Hls === 'undefined') { fail('Hls 未加载 (hls.light.min.js 404?)'); return; }

  var isM3u8 = /\.m3u8(\?|#|$)/i.test(url);

  try {
    var art = new Artplayer({
      container: '#player',
      url: url,
      title: title,
      volume: 0.8,
      autoplay: true,
      pip: true,
      autoSize: false,
      autoMini: false,
      screenshot: false,
      setting: true,
      loop: false,
      flip: true,
      playbackRate: true,
      aspectRatio: true,
      fullscreen: true,
      fullscreenWeb: true,
      playsInline: true,
      miniProgressBar: true,
      mutex: true,
      backdrop: true,
      gesture: true,
      customType: {
        m3u8: function (video, src) {
          if (window.Hls && Hls.isSupported()) {
            var hls = new Hls({});
            hls.loadSource(src);
            hls.attachMedia(video);
            // 记录所有错误（非致命也记，方便定位）
            hls.on(Hls.Events.ERROR, function (event, data) {
              console.log('[hls-error]', data.type, data.details, 'fatal=' + data.fatal);
              if (data.fatal) fail('播放失败：' + (data.type || '未知错误') + ' / ' + (data.details || ''));
            });
            // 播放状态检测：10秒后还没播就报
            var playCheckTimer = setTimeout(function () {
              if (video.paused || video.readyState < 2) {
                fail('流已加载但未播放 (readyState=' + video.readyState + ', paused=' + video.paused + ', src=' + src.substring(0, 80) + ')');
              }
            }, 10000);
            video.addEventListener('playing', function () {
              clearTimeout(playCheckTimer);
              document.getElementById('err').style.display = 'none';
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = src;
          } else {
            fail('当前环境不支持 HLS 播放 (Hls.isSupported=false)');
          }
        },
      },
    });

    if (!isM3u8) {
      art.on('error', function () {
        fail('播放失败，地址可能已失效或格式不支持');
      });
    }

    art.on('ready', function () {
      document.getElementById('err').style.display = 'none';
    });
  } catch (e) {
    fail('播放器初始化失败: ' + (e && e.message || e));
  }
})();