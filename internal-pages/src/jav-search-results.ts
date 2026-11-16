export type JavSearchItem = {
  title: string;
  url: string;
  code?: string | null;
  coverUrl?: string | null;
  variantTags?: string[];
};

export type JavSearchSourceResult = {
  sourceId: string;
  sourceName: string;
  status: "results" | "empty" | "blocked" | "unsupported";
  searchUrl: string;
  items: JavSearchItem[];
};

export type JavSearchGroupedLink = JavSearchItem & { sourceId: string; sourceName: string; canonicalUrl: string };
export type JavSearchResultGroup = { stableId: string; code: string | null; title: string; coverUrl: string | null; links: JavSearchGroupedLink[] };

const FC2_CODE = /(?<![A-Z0-9])FC2[-_ ]*(?:PPV[-_ ]*)?(\d{5,10})(?![A-Z0-9])/i;
const REGULAR_CODE = /(?<![A-Z0-9])([A-Z]{2,10})[-_ ]?(\d{1,10}(?:-\d{2,5})?)(?![A-Z0-9])/i;
const FC2_WHOLE_QUERY = /^FC2[-_ ]*(?:PPV[-_ ]*)?\d{5,10}$/i;
const REGULAR_WHOLE_QUERY = /^[A-Z]{2,10}[-_ ]?\d{1,10}(?:-\d{2,5})?$/i;

export function normalizeJavCode(value: string): string {
  const upper = value.trim().replace(/[–—＿]/g, "-").toUpperCase();
  const fc2 = FC2_CODE.exec(upper);
  if (fc2) return `FC2-PPV-${fc2[1]}`;
  const match = /^([A-Z0-9]+)-(\d+(?:-\d+)*)$/.exec(upper);
  if (!match) return upper;
  return `${match[1]}-${match[2].replace(/-/g, "")}`;
}

export function extractJavCode(...values: string[]): string | null {
  for (const value of values) {
    const fc2 = FC2_CODE.exec(value);
    if (fc2) return `FC2-PPV-${fc2[1]}`;
    const regular = REGULAR_CODE.exec(value);
    if (regular) return normalizeJavCode(`${regular[1].toUpperCase()}-${regular[2]}`);
  }
  return null;
}

export function normalizeJavSearchQuery(rawInput: string): { query: string; exactCode: string | null } {
  const raw = rawInput.trim();
  if (!FC2_WHOLE_QUERY.test(raw) && !REGULAR_WHOLE_QUERY.test(raw)) return { query: raw, exactCode: null };
  const code = extractJavCode(raw);
  return code ? { query: code, exactCode: code } : { query: raw, exactCode: null };
}

export function comparableJavCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function canonicalizeJavUrl(value: string): string | null {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:fbclid|gclid)$/i.test(key) || key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key);
    }
    return url.href;
  } catch {
    return null;
  }
}

export function groupJavSearchResults(results: JavSearchSourceResult[]): JavSearchResultGroup[] {
  const groups = new Map<string, JavSearchResultGroup>();
  const seenByGroup = new Map<string, Set<string>>();
  for (const source of results) {
    for (const item of source.items) {
      const canonicalUrl = canonicalizeJavUrl(item.url) || item.url;
      const code = item.code ? normalizeJavCode(item.code) : extractJavCode(item.title, item.url);
      const key = code ? `code:${comparableJavCode(code)}` : `url:${source.sourceId}:${canonicalUrl}`;
      let group = groups.get(key);
      if (!group) {
        group = { stableId: key, code, title: item.title, coverUrl: item.coverUrl || null, links: [] };
        groups.set(key, group);
        seenByGroup.set(key, new Set());
      }
      const linkKey = `${source.sourceId}\u0000${canonicalUrl}`;
      const seen = seenByGroup.get(key)!;
      if (seen.has(linkKey)) continue;
      seen.add(linkKey);
      group.links.push({ ...item, code, sourceId: source.sourceId, sourceName: source.sourceName, canonicalUrl });
      if (!group.coverUrl && item.coverUrl) group.coverUrl = item.coverUrl;
    }
  }
  return [...groups.values()];
}
