import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalizeJavUrl,
  comparableJavCode,
  extractJavCode,
  groupJavSearchResults,
  normalizeJavCode,
  normalizeJavSearchQuery,
} from "../src/jav-search-results.ts";

const sourceResult = (sourceId, sourceName, items) => ({
  sourceId,
  sourceName,
  status: "results",
  searchUrl: `https://${sourceId}.example/search`,
  items,
});

test("JAV code and FC2 normalization follows the source implementation", () => {
  assert.equal(normalizeJavCode("rebd-01-022"), "REBD-01022");
  assert.equal(normalizeJavCode("LULU-095"), "LULU-095");
  assert.equal(extractJavCode("Title REBD-01-022 Subtitles"), "REBD-01022");
  assert.equal(extractJavCode("FC2 PPV 1234567"), "FC2-PPV-1234567");
  assert.equal(comparableJavCode("FC2-PPV-1234567"), "FC2PPV1234567");
});

test("only full code-shaped input activates exact-code search", () => {
  assert.deepEqual(normalizeJavSearchQuery("REBD-01-022"), { query: "REBD-01022", exactCode: "REBD-01022" });
  assert.deepEqual(normalizeJavSearchQuery("FC2 PPV 1234567"), { query: "FC2-PPV-1234567", exactCode: "FC2-PPV-1234567" });
  assert.deepEqual(normalizeJavSearchQuery("ABP-123 extra"), { query: "ABP-123 extra", exactCode: null });
  assert.deepEqual(normalizeJavSearchQuery("中文关键词"), { query: "中文关键词", exactCode: null });
});

test("canonical detail URLs remove only fragments and common tracking parameters", () => {
  assert.equal(canonicalizeJavUrl("https://example.test/video/1?x=a&utm_source=mail&fbclid=z#part"), "https://example.test/video/1?x=a");
  assert.equal(canonicalizeJavUrl("not a URL"), null);
});

test("cross-site results group only by an extracted code and keep uncodeable links separate", () => {
  const grouped = groupJavSearchResults([
    sourceResult("missav", "MissAV", [
      { title: "REBD-01-022 title", url: "https://missav.ws/en/REBD-01-022?utm_source=x", code: "REBD-01022", variantTags: ["中文字幕"] },
      { title: "No code title", url: "https://missav.ws/en/unique" },
    ]),
    sourceResult("jable", "Jable", [
      { title: "REBD01022 alternate title", url: "https://jable.tv/videos/rebd-01-022/" },
      { title: "No code title", url: "https://jable.tv/videos/unique/" },
    ]),
  ]);
  assert.equal(grouped.length, 3);
  assert.equal(grouped[0].code, "REBD-01022");
  assert.deepEqual(grouped[0].links.map((item) => item.sourceId), ["missav", "jable"]);
  assert.equal(grouped[0].links[0].variantTags[0], "中文字幕");
  assert.notEqual(grouped[1].stableId, grouped[2].stableId);
});
