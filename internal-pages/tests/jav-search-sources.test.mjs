import test from "node:test";
import assert from "node:assert/strict";
import {
  JAV_COMMON_EMPTY_SELECTORS,
  JAV_EMPTY_EXACT_TEXTS,
  JAV_EMPTY_TEXT_PATTERN,
  JAV_SEARCH_SOURCES,
  matchesJavSearchDetailPath,
  matchesJavSearchHost,
  matchesJavSearchSourceHost,
} from "../src/jav-search-sources.ts";

const expected = {
  missav: {
    links: [".thumbnail a[href]", ".video-item a[href]"], cards: [".thumbnail", ".video-item"], empty: [".search-results .no-results", ".search-results .no-result"],
    valid: "/en/ABP-123", invalid: "/EN/ABP123",
  },
  jable: {
    links: [".video-img-box a[href]"], cards: [".video-img-box"], empty: [".search-results .no-results", ".search-results .no-result"],
    valid: "/videos/ABP-123/", invalid: "/search/ABP-123/",
  },
  avjoy: {
    links: [".content-row .content-info a[href]"], cards: [".content-row"], empty: [".search-results .no-results", ".search-results .no-result"],
    valid: "/videos/123/ABP-123", invalid: "/search/videos/ABP-123",
  },
  pigav: {
    links: [".video-item a[href]", ".video a[href]", ".thumbnail a[href]", "a[href*='/w/']", "a[href*='/video/']", "a[href*='/videos/']"],
    cards: [".video-item", ".video", ".thumbnail"], empty: [".search-results .no-results", ".search-results .no-result"],
    valid: "/w/ABP-123", invalid: "/search/ABP-123",
  },
  avtoday: {
    links: [".thumbnail a[href]", ".video-item a[href]"], cards: [".thumbnail", ".video-item"], empty: [".search-results .no-results", ".search-results .no-result"],
    valid: "/cht/videos/ABP-123", invalid: "/search/ABP-123",
  },
  javhd: {
    links: ["article a[href]", ".video-item a[href]"], cards: ["article", ".video-item"], empty: [".search-results .no-results", ".search-results .no-result"],
    valid: "/zh/ja/videos/ABP-123", invalid: "/videos/one/two/three",
  },
  "7mmtv": {
    links: ["a[href*='_content/']"], cards: [".video", ".item", "li", ".thumbnail"], empty: [".search-results .no-results", ".search-results .no-result"],
    valid: "/zh/abc_content/123/ABP-123.html", invalid: "/zh/abc_content/no/ABP-123.html",
  },
  avple: {
    links: ["a[href*='/video/']"], cards: [".video-item", ".video", ".card"], empty: [".search-results .no-results", ".search-results .no-result"],
    valid: "/video/ABP-123", invalid: "/videos/ABP-123",
  },
  whos: {
    links: ["a[href*='/videos/']"], cards: [".video-item", ".video", ".card"], empty: [".search-results .no-results", ".search-results .no-result"],
    valid: "/videos/ABP-123", invalid: "/video/ABP-123",
  },
  javday: {
    links: ["a.videoBox[href]"], cards: [".videoBox"], empty: [".search-results .no-results"],
    valid: "/videos/ABP-123", invalid: "/search/ABP-123",
  },
  supjav: {
    links: [".post a.img[href]", ".post h3 a[href]"], cards: [".post"], empty: [".no-results"],
    valid: "/zh/123.html", invalid: "/123/ABP-123.html",
  },
  javrate: {
    links: [".mgn-item a.movie-card-link[href]"], cards: [".mgn-item"], empty: [".search-page .search-stats-detail"],
    valid: "/movie/detail/12345678-1234-1234-1234-1234567890ab.html", invalid: "/movie/detail/12345678-1234-1234-1234-1234567890ab",
  },
  hentaimama: {
    links: ["article.series-card a.sc-poster[href]", "article.series-card h3.sc-title a[href]", ".dt-series-cards article a.sc-poster[href]"],
    cards: ["article.series-card", ".dt-series-cards article"], empty: [".no-results", ".search-no-results", ".no-result"],
    valid: "/episodes/ABP-123", invalid: "/search/ABP-123",
  },
  rou_video: {
    links: ["main a.group[href^='/v/']"], cards: ["a.group"], empty: ["main h2"],
    valid: "/v/ABP-123_x", invalid: "/s/ABP-123_x",
  },
  rou_series: {
    links: ["main a.group[href^='/s/']"], cards: ["a.group"], empty: ["main h2"],
    valid: "/s/ABP-123_x", invalid: "/v/ABP-123_x",
  },
};

const byId = (id) => JAV_SEARCH_SOURCES.find((source) => source.id === id);

test("all 15 sources keep their configured selectors and explicit empty-state rules", () => {
  assert.equal(JAV_SEARCH_SOURCES.length, 15);
  for (const [id, rules] of Object.entries(expected)) {
    const source = byId(id);
    assert.ok(source, id);
    assert.deepEqual(source.linkSelectors, rules.links, `${id} links`);
    assert.deepEqual(source.cardSelectors, rules.cards, `${id} cards`);
    assert.deepEqual(source.emptySelectors, rules.empty, `${id} empty selectors`);
    assert.equal(typeof source.detailPathPattern, "string", `${id} detail regex`);
  }
  assert.deepEqual(JAV_EMPTY_EXACT_TEXTS, ["沒有找到符合的影集", "沒有找到符合的劇集"]);
  assert.ok(JAV_COMMON_EMPTY_SELECTORS.includes(".search-results-empty"));
  const emptyWords = new RegExp(JAV_EMPTY_TEXT_PATTERN, "i");
  assert.equal(emptyWords.test("未找到相关搜索结果"), true);
  assert.equal(emptyWords.test("No matching videos found"), true);
});

test("all source-specific detail paths accept representative details and reject unrelated routes", () => {
  for (const [id, rules] of Object.entries(expected)) {
    const source = byId(id);
    assert.equal(matchesJavSearchDetailPath(rules.valid, source), true, `${id} should accept ${rules.valid}`);
    assert.equal(matchesJavSearchDetailPath(rules.invalid, source), false, `${id} should reject ${rules.invalid}`);
  }
  for (const route of ["/search/ABP-123", "/tags/ABP-123", "/categories/123", "/actresses/123", "/actors/123", "/makers/123", "/genres/123", "/login/123", "/register/123", "/a-slug-without-digits", "/EN/ABP123", "/EN/foo/bar-123"]) {
    assert.equal(matchesJavSearchDetailPath(route, byId("missav")), false, `missav excludes ${route}`);
  }
  assert.equal(matchesJavSearchDetailPath("/EN/ABP-123", byId("missav")), true, "missav matching is case insensitive");
});

test("every source creates an HTTPS URL with safely encoded query data", () => {
  const query = "FC2 测试 /?&%+";
  assert.equal(JAV_SEARCH_SOURCES.length, 15);
  for (const source of JAV_SEARCH_SOURCES) {
    const url = new URL(source.direct(query));
    assert.equal(url.protocol, "https:", source.id);
    assert.equal(matchesJavSearchSourceHost(url.hostname, source), true, source.id);
    if (url.searchParams.has("search")) assert.equal(url.searchParams.get("search"), query, source.id);
    else if (url.searchParams.has("s")) assert.equal(url.searchParams.get("s"), query, source.id);
    else if (url.searchParams.has("key")) assert.equal(url.searchParams.get("key"), query, source.id);
    else if (url.searchParams.has("q")) assert.equal(url.searchParams.get("q"), query, source.id);
    else assert.ok(decodeURIComponent(url.href).includes(source.id === "javrate" ? query.toLowerCase() : query), source.id);
  }
  assert.equal(byId("pigav").host, "pigav.com");
  assert.equal(new URL(byId("pigav").direct("x")).hostname, "pigav.com");
  assert.match(byId("pigav").direct("two words"), /search=two\+words/);
  assert.match(byId("missav").direct("two words"), /\/search\/two%20words/);
  assert.match(byId("javrate").direct("ABP-123"), /\/abp-123\//);
});

test("host checks allow exact hosts and configured subdomains but reject suffix lookalikes", () => {
  assert.equal(matchesJavSearchHost("jable.tv", "jable.tv"), true);
  assert.equal(matchesJavSearchHost("www.jable.tv", "jable.tv"), true);
  assert.equal(matchesJavSearchHost("notjable.tv", "jable.tv"), false);
  assert.equal(matchesJavSearchHost("jable.tv.evil.test", "jable.tv"), false);
  assert.equal(matchesJavSearchSourceHost("hentaimama.io", byId("hentaimama")), true);
  assert.equal(matchesJavSearchSourceHost("cdn.hentaimama.com", byId("hentaimama")), true);
  assert.equal(matchesJavSearchSourceHost("hentaimama.net.evil.test", byId("hentaimama")), false);
  assert.equal(matchesJavSearchSourceHost("rou.video", byId("rou_video")), true);
  assert.equal(matchesJavSearchSourceHost("rou.video.evil.test", byId("rou_series")), false);
  assert.equal(matchesJavSearchSourceHost("pigav.ws", byId("pigav")), false);
});

test("ROU video and series routes are distinct and series explicitly uses tab=series", () => {
  const video = byId("rou_video");
  const series = byId("rou_series");
  assert.ok(video && series);
  assert.deepEqual(video.codeSelectors, ["span.truncate"]);
  const videoUrl = new URL(video.direct("abc"));
  const seriesUrl = new URL(series.direct("abc"));
  assert.equal(videoUrl.searchParams.get("q"), "abc");
  assert.equal(videoUrl.searchParams.has("tab"), false);
  assert.equal(seriesUrl.searchParams.get("q"), "abc");
  assert.equal(seriesUrl.searchParams.get("tab"), "series");
});
