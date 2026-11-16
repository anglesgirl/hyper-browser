import {
  JAV_COMMON_EMPTY_SELECTORS,
  JAV_EMPTY_EXACT_TEXTS,
  JAV_EMPTY_TEXT_PATTERN,
  JAV_SEARCH_SOURCES,
  matchesJavSearchDetailPath,
  matchesJavSearchSourceHost,
} from "./jav-search-sources";
import type { JavSearchSource } from "./jav-search-sources";
import {
  canonicalizeJavUrl,
  comparableJavCode,
  extractJavCode,
  normalizeJavSearchQuery,
} from "./jav-search-results";
import type { JavSearchItem } from "./jav-search-results";

const ACTIVE_KEY = "javSearchActiveRun";
const LAST_KEY = "javSearchLastRun";
const MAX_RESULTS = 30;
type Item = JavSearchItem;
type CollectionStatus = "results" | "empty" | "blocked" | "unsupported";
type SourceResult = { sourceId: string; sourceName: string; status: CollectionStatus; searchUrl: string; items: Item[] };
type Run = { id: string; query: string; searchTerm: string; exactCode: string | null; sourceIds: string[]; index: number; results: SourceResult[] };
type Collection = { target?: string; action?: string; id?: string; sourceId?: string; status?: string; items?: unknown };

function storage() {
  const local = browser?.storage?.local;
  if (!local) throw new Error("Extension storage is unavailable.");
  return local;
}

function markedUrl(base: string, id: string, sourceId: string): string {
  const url = new URL(base);
  url.searchParams.set("__jav_search_id", id);
  url.searchParams.set("__jav_search_source", sourceId);
  return url.toString();
}

function getCurrentSource(run: Run, currentUrl: URL, id: string, sourceId: string): JavSearchSource | null {
  if (currentUrl.protocol !== "https:" || currentUrl.searchParams.get("__jav_search_id") !== id ||
      currentUrl.searchParams.get("__jav_search_source") !== sourceId) return null;
  if (run.id !== id || run.sourceIds[run.index] !== sourceId) return null;
  const source = JAV_SEARCH_SOURCES.find((candidate) => candidate.id === sourceId);
  if (!source || !matchesJavSearchSourceHost(currentUrl.hostname, source)) return null;
  return source;
}

async function activeRunFor(message: Collection, senderUrl: string): Promise<{ run: Run; source: JavSearchSource; currentUrl: URL } | null> {
  if (typeof message.id !== "string" || typeof message.sourceId !== "string") return null;
  let currentUrl: URL;
  try { currentUrl = new URL(senderUrl); } catch { return null; }
  const values = await storage().get(ACTIVE_KEY);
  const run = values[ACTIVE_KEY] as Run | undefined;
  if (!run) return null;
  const source = getCurrentSource(run, currentUrl, message.id, message.sourceId);
  return source ? { run, source, currentUrl } : null;
}

export async function getJavSearchCollectionRules(message: Collection, senderUrl: string): Promise<unknown | null> {
  const active = await activeRunFor(message, senderUrl);
  if (!active) return null;
  const { source } = active;
  return {
    sourceId: source.id,
    linkSelectors: source.linkSelectors,
    cardSelectors: source.cardSelectors,
    codeSelectors: source.codeSelectors || [],
    detailPathPattern: source.detailPathPattern,
    detailPathFlags: source.detailPathFlags || "",
    emptySelectors: [...source.emptySelectors, ...JAV_COMMON_EMPTY_SELECTORS],
    emptyTextPattern: source.emptyTextPattern || JAV_EMPTY_TEXT_PATTERN,
    emptyTextFlags: source.emptyTextFlags || "i",
    emptyExactTexts: source.emptyExactTexts || JAV_EMPTY_EXACT_TEXTS,
  };
}

function cleanCover(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

function cleanItems(value: unknown, source: JavSearchSource, exactCode: string | null): Item[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: Item[] = [];
  for (const candidate of value.slice(0, MAX_RESULTS * 3)) {
    if (!candidate || typeof candidate !== "object") continue;
    const row = candidate as Record<string, unknown>;
    if (typeof row.title !== "string" || typeof row.url !== "string") continue;
    const title = row.title.trim().replace(/\s+/g, " ").slice(0, 240);
    let url: URL;
    try { url = new URL(row.url); } catch { continue; }
    if (!title || url.protocol !== "https:" || (url.port && url.port !== "443") || url.username || url.password ||
        !matchesJavSearchSourceHost(url.hostname, source) || !matchesJavSearchDetailPath(url.pathname, source)) continue;
    const canonicalUrl = canonicalizeJavUrl(url.href);
    if (!canonicalUrl || seen.has(canonicalUrl)) continue;
    const code = extractJavCode(typeof row.code === "string" ? row.code : "", title, canonicalUrl);
    if (exactCode && (!code || comparableJavCode(code) !== comparableJavCode(exactCode))) continue;
    seen.add(canonicalUrl);
    const item: Item = { title, url: canonicalUrl };
    if (code) item.code = code;
    const coverUrl = cleanCover(row.coverUrl);
    if (coverUrl) item.coverUrl = coverUrl;
    if (Array.isArray(row.variantTags)) {
      const tags = row.variantTags.filter((tag): tag is string => tag === "中文字幕" || tag === "無碼" || tag === "4K").slice(0, 6);
      if (tags.length) item.variantTags = [...new Set(tags)];
    }
    items.push(item);
    if (items.length >= MAX_RESULTS) break;
  }
  return items;
}

export async function handleJavSearchCommand(type: string, payload?: unknown): Promise<unknown> {
  if (type === "jav.search.results") {
    const values = await storage().get(LAST_KEY);
    return (values[LAST_KEY] as Run | undefined) || null;
  }
  if (type !== "jav.search.start") throw new Error("Unknown JAV search command.");
  const data = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const query = typeof data.query === "string" ? data.query.trim().slice(0, 160) : "";
  const requested = Array.isArray(data.sources) ? data.sources.filter((id): id is string => typeof id === "string") : [];
  const sourceIds = JAV_SEARCH_SOURCES.filter((source) => requested.includes(source.id)).map((source) => source.id);
  if (!query || !sourceIds.length) throw new Error("Enter a search term and select at least one source.");
  const normalized = normalizeJavSearchQuery(query);
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const run: Run = { id, query, searchTerm: normalized.query, exactCode: normalized.exactCode, sourceIds, index: 0, results: [] };
  await storage().set({ [ACTIVE_KEY]: run });
  const source = JAV_SEARCH_SOURCES.find((candidate) => candidate.id === sourceIds[0])!;
  return { url: markedUrl(source.direct(run.searchTerm), id, source.id) };
}

export async function collectJavSearchPage(message: Collection, senderUrl: string): Promise<{ nextUrl: string; done: boolean } | null> {
  const active = await activeRunFor(message, senderUrl);
  if (!active) return null;
  const { run, source } = active;
  const items = cleanItems(message.items, source, run.exactCode);
  const requestedStatus: CollectionStatus = message.status === "blocked" || message.status === "empty" || message.status === "unsupported"
    ? message.status : "results";
  const status: CollectionStatus = requestedStatus === "blocked" ? "blocked"
    : items.length > 0 ? "results"
      : requestedStatus === "empty" ? "empty" : "unsupported";
  const searchUrl = new URL(source.direct(run.searchTerm));
  run.results.push({ sourceId: source.id, sourceName: source.name, status, searchUrl: searchUrl.href, items });
  run.index += 1;
  if (run.index >= run.sourceIds.length) {
    await storage().set({ [LAST_KEY]: { id: run.id, query: run.query, results: run.results } });
    await storage().remove(ACTIVE_KEY);
    return { nextUrl: browser?.runtime?.getURL?.("home.html#jav-search-results") || "", done: true };
  }
  await storage().set({ [ACTIVE_KEY]: run });
  const next = JAV_SEARCH_SOURCES.find((candidate) => candidate.id === run.sourceIds[run.index])!;
  return { nextUrl: markedUrl(next.direct(run.searchTerm), run.id, next.id), done: false };
}
