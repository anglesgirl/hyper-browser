import React, { useEffect, useMemo, useState } from "react";
import { t } from "./i18n";
import { sendBackgroundCommand } from "./background-command";
import { JAV_SEARCH_SOURCES } from "./jav-search-sources";
import { groupJavSearchResults } from "./jav-search-results";
import type { JavSearchSourceResult } from "./jav-search-results";

type SearchRun = { id: string; query: string; results: JavSearchSourceResult[] };

function localizedVariantTags(tags: string[] = []): string {
  return tags.map((tag) => tag === "中文字幕" ? t("javSearch.tagSubtitles") : tag === "無碼" ? t("javSearch.tagUncensored") : tag).join(" / ");
}

export function JavSearchDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(JAV_SEARCH_SOURCES.map((source) => source.id));
  const [run, setRun] = useState<SearchRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const labels = useMemo(() => JAV_SEARCH_SOURCES.map((source) => source.name).join(", "), []);
  const groups = useMemo(() => run ? groupJavSearchResults(run.results) : [], [run]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (location.hash !== "#jav-search-results") return;
    let cancelled = false;
    void sendBackgroundCommand<SearchRun | null>("jav.search.results")
      .then((result) => { if (!cancelled) setRun(result); })
      .catch(() => { if (!cancelled) setError(t("javSearch.loadFailed")); });
    return () => { cancelled = true; };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    if (!term || selected.length === 0 || busy) return;
    setBusy(true); setError(""); setRun(null);
    try {
      const next = await sendBackgroundCommand<{ url: string }>("jav.search.start", { query: term, sources: selected });
      window.location.href = next.url;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("javSearch.startFailed")); setBusy(false);
    }
  };

  return <div className="jav-search-overlay" role="presentation" onClick={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section className="jav-browser-home" role="dialog" aria-modal="true" aria-label={t("javSearch.title")}>
      <header className="jav-nav-heading">
        <h2>{t("javSearch.title")}</h2>
        <button type="button" className="jav-dialog-close" aria-label={t("common.close")} title={t("common.close")} onClick={onClose}>×</button>
      </header>
      <div className="jav-search-panel">
        <p>{t("javSearch.scope", { count: JAV_SEARCH_SOURCES.length, sources: labels })}</p>
        <form onSubmit={submit}>
          <label className="jav-query-label" htmlFor="jav-query">{t("javSearch.queryLabel")}</label>
          <div className="jav-query-row">
            <input id="jav-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("javSearch.placeholder")} required autoComplete="off" />
            <button type="submit" disabled={busy || !query.trim() || selected.length === 0}>{busy ? t("javSearch.loading") : t("javSearch.submit")}</button>
          </div>
          <fieldset className="jav-source-list">
            <legend>{t("javSearch.sources")}</legend>
            <div>{JAV_SEARCH_SOURCES.map((source) => <label key={source.id}>
              <input type="checkbox" checked={selected.includes(source.id)} onChange={() => setSelected((current) => current.includes(source.id) ? current.filter((id) => id !== source.id) : [...current, source.id])} />
              {source.name}
            </label>)}</div>
          </fieldset>
        </form>
        <p className="jav-search-note">{t("javSearch.notice")}</p>
        {error && <p role="alert" className="jav-search-error">{error}</p>}
        {run && <div className="jav-results"><h3>{t("javSearch.resultsFor", { query: run.query })}</h3>
          {groups.length > 0 && <div className="jav-result-groups"><h4>{t("javSearch.grouped")}</h4>
            {groups.map((group) => <section className="jav-source-results" key={group.stableId}>
              <header><strong>{group.code || group.title}</strong><span>{t("javSearch.found", { count: group.links.length })}</span></header>
              {group.code && group.title !== group.code && <p className="jav-result-title">{group.title}</p>}
              {group.coverUrl && <img className="jav-result-cover" src={group.coverUrl} alt="" loading="lazy" />}
              <ul>{group.links.map((item) => <li key={`${item.sourceId}-${item.canonicalUrl}`}>
                <a href={item.url}>{item.sourceName}{item.variantTags?.length ? ` · ${localizedVariantTags(item.variantTags)}` : ""}{group.code ? `: ${item.title}` : ""}</a>
              </li>)}</ul>
            </section>)}
          </div>}
          <h4>{t("javSearch.sources")}</h4>
          {run.results.map((result) => <section className="jav-source-results" key={result.sourceId}>
            <header><strong>{result.sourceName}</strong><span>{result.status === "results" ? t("javSearch.found", { count: result.items.length }) : result.status === "blocked" ? t("javSearch.blocked") : result.status === "empty" ? t("javSearch.empty") : t("javSearch.unsupported")}</span></header>
            {result.status !== "results" && <p>{t("javSearch.sourceLimited")}</p>}
            <a className="jav-direct-link" href={result.searchUrl}>{t("javSearch.openSource", { source: result.sourceName })} ↗</a>
          </section>)}
        </div>}
      </div>
    </section>
  </div>;
}
