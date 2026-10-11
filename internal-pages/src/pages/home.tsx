import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  DEFAULT_LAUNCHER_DOCK_ENTRY_IDS,
  LauncherPage,
  createLauncherLabels,
  createLauncherSystemEntries,
  type LauncherPlatform,
  type LauncherSystemEntryTheme,
} from "@hyper-launcher";
import { createLauncherWebDavSyncLabels, useLauncherWebDavSync, type LauncherWebDavSyncEvent, type LauncherWebDavSyncOptions } from "@hyper-sync/launcher-webdav-sync";
import { formatSyncResult, isSyncResultLike } from "@hyper-sync/sync-result";
import type { SyncSettingsDialogValues } from "@hyper-sync/settings-dialog";
import "../hyper-browser";
import type { BrowserSettings, WebAppItem, WebDavSyncResult } from "../hyper-browser";
import "../styles.css";
import { t } from "../i18n";
import { createLauncherLayoutStorage, waitForLauncherLayoutSaves } from "../launcher-layout-storage";
import { isPlainObject, sendBackgroundCommand } from "../background-command";

const AUTO_SYNC_DEBOUNCE_MS = 1800;
const ANDROID_SYSTEM_ENTRY_THEME: LauncherSystemEntryTheme = {
  bookmarks: { color: "#0d7f66" },
  history: { color: "#f4a900" },
  extensions: { color: "#d73547" },
};

function HomePage() {
  const storage = useMemo(() => createLauncherLayoutStorage(), []);
  const translate = useCallback((key: string, values?: Record<string, unknown>) =>
    t(key as Parameters<typeof t>[0], (values || {}) as Record<string, string | number>),
  []);
  const webDavLabels = useMemo(() => createLauncherWebDavSyncLabels(translate), [translate]);
  const launcherLabels = useMemo(() => createLauncherLabels(translate), [translate]);

  const saveSyncSettings = useCallback(async (values: SyncSettingsDialogValues): Promise<BrowserSettings> => {
    if (!isHttpUrl(values.webDavUrl.trim())) {
      throw new Error(t("settings.webDavUrlRequired"));
    }
    return window.hyperBrowser.updateWebDavSyncSettings({
      webDavSyncEnabled: values.webDavUrl.trim().length > 0,
      webDavSyncUrl: values.webDavUrl.trim(),
      webDavSyncUsername: values.username.trim(),
      webDavSyncPassword: values.password,
      webDavSyncDeviceName: "Android",
    });
  }, []);

  const subscribeSyncEvents = useCallback((listener: (event: LauncherWebDavSyncEvent<WebDavSyncResult>) => void) => {
    const onMessage = (message: unknown) => {
      if (!isPlainObject(message)) return;
      if (message.type !== "remote.synced" && message.type !== "launcher.changed") return;
      listener({
        type: message.type,
        syncResult: isSyncResultLike(message.syncResult) ? message.syncResult as WebDavSyncResult : null,
      });
    };
    browser?.runtime?.onMessage?.addListener(onMessage);
    return () => browser?.runtime?.onMessage?.removeListener(onMessage);
  }, []);

  const webDavOptions = useMemo<LauncherWebDavSyncOptions<BrowserSettings, WebDavSyncResult>>(() => ({
    labels: webDavLabels,
    loadSettings: () => window.hyperBrowser.requestSettingsData(),
    saveSettings: saveSyncSettings,
    isConfigured: isWebDavConfigured,
    settingsToDialogValues,
    normalizeDialogValues,
    runSync: (options) => sendBackgroundCommand<WebDavSyncResult>(
      "sync.run",
      options?.mode ? { mode: options.mode } : undefined,
    ),
    scheduleSyncSoon: () => sendBackgroundCommand("sync.soon"),
    summarizeResult: webDavSyncSummary,
    resultSettings: (result) => result.settings,
    subscribeSyncEvents,
    beforeManualSync: waitForLauncherLayoutSaves,
    beforeScheduleSync: waitForLauncherLayoutSaves,
    autoSyncDebounceMs: AUTO_SYNC_DEBOUNCE_MS,
    showFolderTitle: false,
  }), [saveSyncSettings, subscribeSyncEvents, webDavLabels]);
  const webDavSync = useLauncherWebDavSync(webDavOptions);

  const systemEntries = useMemo(() => createLauncherSystemEntries(translate, ANDROID_SYSTEM_ENTRY_THEME), [translate]);

  const platform = useMemo<LauncherPlatform>(() => ({
    systemEntries,
    defaultDockEntryIds: DEFAULT_LAUNCHER_DOCK_ENTRY_IDS,
    loadApps: () => window.hyperBrowser.requestAppsData(),
    openApp: (app) => {
      window.hyperBrowser.openApp(app.id);
    },
    openStandaloneApp: (app) => {
      window.hyperBrowser.openStandaloneApp(app.id);
    },
    openSystem: (action) => {
      if (action === "bookmarks") window.hyperBrowser.showBookmarks();
      if (action === "history") window.hyperBrowser.showHistory();
      if (action === "extensions") window.hyperBrowser.showExtensions();
    },
    deleteApp: async (app) => {
      const items = await sendBackgroundCommand<WebAppItem[]>("webapps.delete", { id: app.id });
      return items;
    },
    saveApp: async (app, changes) => {
      const items = await sendBackgroundCommand<WebAppItem[]>("webapps.save", {
        ...app,
        ...changes,
        id: app.id,
      });
      return items;
    },
    chooseAppIcon: (app) => window.hyperBrowser.chooseAppIcon(app.id),
    pinApp: (app) => {
      window.hyperBrowser.pinApp(app.id);
    },
    updateAppIcon: async (app, iconDataUrl) => {
      const items = await sendBackgroundCommand<WebAppItem[]>("webapps.save", {
        ...app,
        id: app.id,
        iconDataUrl,
        iconSource: iconDataUrl ? "custom" : "site",
      });
      return items;
    },
  }), [systemEntries]);

  return (
    <>
      <div className="ao3-home-top">
        <QuickLinks />
        <RecentWorks />
      </div>
      <LauncherPage
        labels={launcherLabels}
        platform={platform}
        layoutStorage={storage}
        refreshToken={webDavSync.refreshToken}
        previewLayoutMode="compact"
        onLayoutChanged={webDavSync.onLayoutChanged}
        topActions={webDavSync.topActions}
        variant="mobile"
      />
      {webDavSync.settingsDialog}
    </>
  );
}

// ===== AO3 Reader 常用入口卡片 =====
type QuickLink = {
  label: string;
  url?: string;
  downloads?: boolean;
  color: string;
};

const QUICK_LINKS: QuickLink[] = [
  { label: "作品库", url: "https://archiveofourown.org/works", color: "#d73547" },
  { label: "搜索", url: "https://archiveofourown.org/search", color: "#0d7f66" },
  { label: "收藏", url: "https://archiveofourown.org/bookmarks", color: "#7b4fd8" },
  { label: "我的下载", downloads: true, color: "#f4a900" },
];

function QuickLinks() {
  return (
    <div className="ao3-quicklinks">
      {QUICK_LINKS.map((link) => (
        <button
          key={link.label}
          type="button"
          className="ao3-quicklink"
          style={{ borderTopColor: link.color }}
          onClick={() => {
            if (link.downloads) {
              window.hyperBrowser.showDownloads();
            } else if (link.url) {
              window.location.href = link.url;
            }
          }}
        >
          <span className="ao3-quicklink-label">{link.label}</span>
        </button>
      ))}
    </div>
  );
}

// ===== AO3 Reader 最近作品（经 ao3-zh 扩展后台拉取解析） =====
type RecentWork = {
  title: string;
  url: string;
  author: string;
};

function RecentWorks() {
  const [items, setItems] = useState<RecentWork[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    const message = browser?.runtime?.sendMessage?.({
      type: "ao3.fetchHtml",
      url: "https://archiveofourown.org/works",
    });
    if (!message || typeof message.then !== "function") {
      setState("error");
      return;
    }
    message
      .then((resp: unknown) => {
        if (cancelled) return;
        const r = resp as { ok?: boolean; data?: unknown } | null;
        if (!r || r.ok !== true || typeof r.data !== "string") {
          setState("error");
          return;
        }
        try {
          const doc = new DOMParser().parseFromString(r.data, "text/html");
          const parsed: RecentWork[] = Array.from(doc.querySelectorAll("li.work.blurb"))
            .slice(0, 8)
            .map((li) => {
              const a = li.querySelector("h4.heading a[href]");
              const author = li.querySelector("a.rel.author");
              const href = a?.getAttribute("href") || "";
              return {
                title: (a?.textContent || "").trim() || "(untitled)",
                url: href ? new URL(href, "https://archiveofourown.org").href : "",
                author: (author?.textContent || "").trim(),
              };
            })
            .filter((work) => work.url.length > 0);
          setItems(parsed);
          setState("ready");
        } catch {
          setState("error");
        }
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openWorks = () => {
    window.location.href = "https://archiveofourown.org/works";
  };

  return (
    <section className="ao3-recent">
      <div className="ao3-recent-head">
        <span>最近作品</span>
        <button type="button" className="ao3-recent-more" onClick={openWorks}>更多 →</button>
      </div>
      {state === "loading" && <div className="ao3-recent-note">加载最近作品中…</div>}
      {state === "error" && (
        <button type="button" className="ao3-recent-fallback" onClick={openWorks}>
          最近作品加载失败，点此直接打开 AO3
        </button>
      )}
      {state === "ready" && items.length === 0 && (
        <button type="button" className="ao3-recent-fallback" onClick={openWorks}>
          暂无最近作品，点此打开 AO3
        </button>
      )}
      {state === "ready" && items.length > 0 && (
        <ul className="ao3-recent-list">
          {items.map((work) => (
            <li key={work.url}>
              <button
                type="button"
                className="ao3-recent-item"
                onClick={() => {
                  window.location.href = work.url;
                }}
              >
                <span className="ao3-recent-title">{work.title}</span>
                {work.author.length > 0 && <span className="ao3-recent-author">{work.author}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function isWebDavConfigured(settings: BrowserSettings): boolean {
  return settings.webDavSyncUrl.trim().length > 0;
}

function settingsToDialogValues(settings: BrowserSettings): SyncSettingsDialogValues {
  return {
    webDavUrl: settings.webDavSyncUrl,
    username: settings.webDavSyncUsername,
    password: settings.webDavSyncPassword,
    deviceName: settings.webDavSyncDeviceName,
    deviceId: settings.webDavSyncDeviceId,
  };
}

function normalizeDialogValues(values: SyncSettingsDialogValues): SyncSettingsDialogValues {
  return {
    ...values,
    webDavUrl: values.webDavUrl.trim(),
    username: values.username.trim(),
    deviceName: "Android",
  };
}

function isHttpUrl(value: string) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

function webDavSyncSummary(result: WebDavSyncResult): string {
  return formatSyncResult(result, {
    complete: ({ bookmarks, webApps, deleted }) => t("settings.webDavSyncComplete", {
      bookmarks,
      webApps,
      deleted,
    }),
    pending: (pending) => t("settings.webDavSyncPending", { pending }),
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HomePage />
  </React.StrictMode>
);
