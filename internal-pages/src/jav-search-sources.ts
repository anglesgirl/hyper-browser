export type JavSearchSource = {
  id: string;
  name: string;
  host: string;
  /** Additional host aliases explicitly declared by the JAV Browser source. */
  allowedHosts?: string[];
  direct: (query: string) => string;
  linkSelectors: string[];
  cardSelectors: string[];
  codeSelectors?: string[];
  detailPathPattern: string;
  detailPathFlags?: string;
  emptySelectors: string[];
  emptyTextPattern?: string;
  emptyTextFlags?: string;
  emptyExactTexts?: string[];
};

// SearchSiteRegistry uses URLEncoder for query parameters and converts spaces to %20 in path queries.
const formQuery = (value: string) => new URLSearchParams({ q: value }).toString().slice(2);
const pathQuery = (value: string) => formQuery(value).replace(/\+/g, "%20");
const commonSiteEmpty = [".search-results .no-results", ".search-results .no-result"];

// Mirrors SearchPageClassifier.emptyWords; it is only applied to visible, eligible empty-state nodes.
export const JAV_EMPTY_TEXT_PATTERN = String.raw`^(?:(?:sorry|抱歉|很抱歉)[,，!！:：.。]?\s*)?(?:no (?:matching )?(?:search )?(?:results?|videos?|items?)(?: (?:were )?found)?|nothing (?:was )?found|沒有(?:找到)?(?:任何|符合條件的|符合的|相關的|相關)?(?:搜尋|搜索)?(?:結果|影片|項目)|查無(?:搜尋|搜索)?(?:結果|資料)|找不到(?:任何|符合條件的|符合的|相關)?(?:結果|影片|資料)|未找到(?:任何|相關的|相关的|相關|相关)?(?:搜尋|搜索)?(?:結果|结果|影片|视频)|検索結果(?:が|は)?(?:ありません|見つかりません)|該当する(?:動画|結果)(?:が|は)?ありません)(?:[.!。！:：,，\s-].*)?$`;
export const JAV_EMPTY_EXACT_TEXTS = ["沒有找到符合的影集", "沒有找到符合的劇集"];
export const JAV_COMMON_EMPTY_SELECTORS = [
  ".no-results", ".no-result", ".search-empty", ".search-no-results",
  ".search-results-empty", "#no-results", "[data-search-empty=true]",
];

export const JAV_SEARCH_SOURCES: JavSearchSource[] = [
  {
    id: "missav", name: "MissAV", host: "missav.ws",
    direct: term => `https://missav.ws/search/${pathQuery(term)}`,
    linkSelectors: [".thumbnail a[href]", ".video-item a[href]"], cardSelectors: [".thumbnail", ".video-item"],
    detailPathPattern: "^(?!/(?:search|tags?|categories?|actresses|actors|makers|genres|login|register)(?:/|$))(?:/[A-Za-z0-9-]{1,16})?/(?=[^/]*\\d)[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+/?$",
    detailPathFlags: "i", emptySelectors: commonSiteEmpty,
  },
  {
    id: "jable", name: "Jable", host: "jable.tv",
    direct: term => `https://jable.tv/search/${pathQuery(term)}/`,
    linkSelectors: [".video-img-box a[href]"], cardSelectors: [".video-img-box"],
    detailPathPattern: "^/videos/[^/]+/?$", detailPathFlags: "i", emptySelectors: commonSiteEmpty,
  },
  {
    id: "avjoy", name: "AVJOY", host: "avjoy.me",
    direct: term => `https://avjoy.me/search/videos/${pathQuery(term)}`,
    linkSelectors: [".content-row .content-info a[href]"], cardSelectors: [".content-row"],
    detailPathPattern: "^/videos?/(?:[0-9]+/)?[^/]+/?$", detailPathFlags: "i", emptySelectors: commonSiteEmpty,
  },
  {
    id: "pigav", name: "PigAV", host: "pigav.com",
    direct: term => `https://pigav.com/search?search=${formQuery(term)}&searchTarget=local`,
    linkSelectors: [".video-item a[href]", ".video a[href]", ".thumbnail a[href]", "a[href*='/w/']", "a[href*='/video/']", "a[href*='/videos/']"],
    cardSelectors: [".video-item", ".video", ".thumbnail"], detailPathPattern: "^/(?:w|video|videos)/[^/]+/?$", detailPathFlags: "i", emptySelectors: commonSiteEmpty,
  },
  {
    id: "avtoday", name: "AVToday", host: "avtoday.io",
    direct: term => `https://avtoday.io/search?s=${formQuery(term)}`,
    linkSelectors: [".thumbnail a[href]", ".video-item a[href]"], cardSelectors: [".thumbnail", ".video-item"],
    detailPathPattern: "^/(?:[a-z0-9_-]+/)?videos?/[^/]+/?$", detailPathFlags: "i", emptySelectors: commonSiteEmpty,
  },
  {
    id: "javhd", name: "JavHDPorn", host: "javhdporn.net",
    direct: term => `https://www.javhdporn.net/?s=${formQuery(term)}`,
    linkSelectors: ["article a[href]", ".video-item a[href]"], cardSelectors: ["article", ".video-item"],
    detailPathPattern: "^/(?:videos?/|zh/(?:[^/]+/)?videos?/)?[^/]+/?$", detailPathFlags: "i", emptySelectors: commonSiteEmpty,
  },
  {
    id: "7mmtv", name: "7MMTV", host: "7mmtv.sx",
    direct: term => `https://7mmtv.sx/zh/searchall_search/all/${pathQuery(term)}/1.html`,
    linkSelectors: ["a[href*='_content/']"], cardSelectors: [".video", ".item", "li", ".thumbnail"],
    detailPathPattern: "^/(?:[a-z]+/)?[a-z_]+_content/[0-9]+/[^/]+\\.html$", detailPathFlags: "i", emptySelectors: commonSiteEmpty,
  },
  {
    id: "avple", name: "AVPLE", host: "avple.tv",
    direct: term => `https://avple.tv/search?key=${formQuery(term)}`,
    linkSelectors: ["a[href*='/video/']"], cardSelectors: [".video-item", ".video", ".card"],
    detailPathPattern: "^/video/[^/]+/?$", detailPathFlags: "i", emptySelectors: commonSiteEmpty,
  },
  {
    id: "whos", name: "Whos.tv", host: "whos.tv",
    direct: term => `https://whos.tv/result?search=${formQuery(term)}`,
    linkSelectors: ["a[href*='/videos/']"], cardSelectors: [".video-item", ".video", ".card"],
    detailPathPattern: "^/videos/[^/]+/?$", detailPathFlags: "i", emptySelectors: commonSiteEmpty,
  },
  {
    id: "javday", name: "JAVDAY", host: "javday.app",
    direct: term => `https://javday.app/search/wd/${pathQuery(term)}/`,
    linkSelectors: ["a.videoBox[href]"], cardSelectors: [".videoBox"],
    detailPathPattern: "^/videos/[^/]+/?$", detailPathFlags: "i", emptySelectors: [".search-results .no-results"],
  },
  {
    id: "supjav", name: "SUPJAV", host: "supjav.com",
    direct: term => `https://supjav.com/?s=${formQuery(term)}`,
    linkSelectors: [".post a.img[href]", ".post h3 a[href]"], cardSelectors: [".post"],
    detailPathPattern: "^/(?:zh/|en/|ja/)?[0-9]+\\.html$", detailPathFlags: "i", emptySelectors: [".no-results"],
  },
  {
    id: "javrate", name: "JavRate", host: "javrate.com",
    direct: term => `https://www.javrate.com/search/a%E7%89%87/${pathQuery(term.toLowerCase())}/?tab=movie`,
    linkSelectors: [".mgn-item a.movie-card-link[href]"], cardSelectors: [".mgn-item"],
    detailPathPattern: "^/movie/detail/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\\.html$", detailPathFlags: "i",
    emptySelectors: [".search-page .search-stats-detail"],
  },
  {
    id: "hentaimama", name: "HentaiMama", host: "hentaimama.io", allowedHosts: ["hentaimama.com", "hentaimama.net"],
    direct: term => `https://hentaimama.io/?s=${formQuery(term)}`,
    linkSelectors: ["article.series-card a.sc-poster[href]", "article.series-card h3.sc-title a[href]", ".dt-series-cards article a.sc-poster[href]"],
    cardSelectors: ["article.series-card", ".dt-series-cards article"], detailPathPattern: "^/(?:episodes|tvshows)/[^/]+/?$", detailPathFlags: "i",
    emptySelectors: [".no-results", ".search-no-results", ".no-result"],
  },
  {
    id: "rou_video", name: "ROU · Videos", host: "rouvb1.xyz", allowedHosts: ["rou.video"],
    direct: term => `https://rouvb1.xyz/search?q=${formQuery(term)}`,
    linkSelectors: ["main a.group[href^='/v/']"], cardSelectors: ["a.group"],
    codeSelectors: ["span.truncate"],
    detailPathPattern: "^/v/[A-Za-z0-9_-]+/?$", emptySelectors: ["main h2"],
    emptyTextPattern: JAV_EMPTY_TEXT_PATTERN, emptyTextFlags: "i", emptyExactTexts: JAV_EMPTY_EXACT_TEXTS,
  },
  {
    id: "rou_series", name: "ROU · Series", host: "rouvb1.xyz", allowedHosts: ["rou.video"],
    direct: term => `https://rouvb1.xyz/search?q=${formQuery(term)}&tab=series`,
    linkSelectors: ["main a.group[href^='/s/']"], cardSelectors: ["a.group"],
    detailPathPattern: "^/s/[A-Za-z0-9_-]+/?$", emptySelectors: ["main h2"],
    emptyTextPattern: JAV_EMPTY_TEXT_PATTERN, emptyTextFlags: "i", emptyExactTexts: JAV_EMPTY_EXACT_TEXTS,
  },
];

export function matchesJavSearchHost(host: string, allowedHost: string): boolean {
  const normalized = host.toLowerCase().replace(/\.$/, "");
  const allowed = allowedHost.toLowerCase().replace(/\.$/, "");
  return normalized === allowed || normalized.endsWith(`.${allowed}`);
}

export function matchesJavSearchSourceHost(host: string, source: JavSearchSource): boolean {
  return [source.host, ...(source.allowedHosts || [])].some((allowedHost) => matchesJavSearchHost(host, allowedHost));
}

export function matchesJavSearchDetailPath(pathname: string, source: JavSearchSource): boolean {
  try {
    return new RegExp(source.detailPathPattern, source.detailPathFlags || "").test(pathname);
  } catch {
    return false;
  }
}
