import React from 'react';
import { AlertTriangle, BarChart3, Lightbulb, Minus } from 'lucide-react';

import { VAULT_VERSION_DETAIL_COPY } from 'features/vault/constants/versionDetailContent';
import type { CoverageBar, SuggestionCard } from 'features/vault/utils/versionDetailPresentation';
import { getScoreGaugeStyle } from 'features/vault/utils/versionDetailPresentation';

type VaultVersionDetailInsightsProps = {
  score: number | null;
  summaryLine: string;
  coverageBars: CoverageBar[];
  atsFlags: string[];
  suggestions: SuggestionCard[];
};

function CoverageBarRow({ bar }: { bar: CoverageBar }) {
  return (
    <div>
      <div className="vault-version-detail__coverage-head">
        <span>{bar.label}</span>
        <span className={`vault-version-detail__coverage-value vault-version-detail__coverage-value--${bar.tone}`}>
          {bar.percent}%
        </span>
      </div>
      <div className="vault-version-detail__coverage-track">
        <div
          className={`vault-version-detail__coverage-fill vault-version-detail__coverage-fill--${bar.tone}`}
          style={{ width: `${bar.percent}%` }}
        />
      </div>
    </div>
  );
}

export default function VaultVersionDetailInsights({
  score,
  summaryLine,
  coverageBars,
  atsFlags,
  suggestions,
}: VaultVersionDetailInsightsProps) {
  const copy = VAULT_VERSION_DETAIL_COPY;
  const displayScore = score ?? 0;

  return (
    <aside className="vault-version-detail__insights">
      <div className="vault-version-detail__card vault-version-detail__card--analysis">
        <div className="vault-version-detail__card-glow" aria-hidden />
        <h2 className="vault-version-detail__card-eyebrow">{copy.analysisEngine}</h2>
        <div className="vault-version-detail__gauge" style={getScoreGaugeStyle(score)}>
          <div className="vault-version-detail__gauge-inner">
            <span className="vault-version-detail__gauge-score">{displayScore || '—'}</span>
            <span className="vault-version-detail__gauge-label">{copy.match}</span>
          </div>
        </div>
        <p className="vault-version-detail__summary">
          {summaryLine || copy.emptySummary}
        </p>
      </div>

      <div className="vault-version-detail__card">
        <div className="vault-version-detail__card-title-row">
          <h3 className="vault-version-detail__card-title">{copy.coverageDensity}</h3>
          <BarChart3 className="h-[18px] w-[18px] text-[var(--color-on-surface-variant)]" aria-hidden />
        </div>
        <div className="vault-version-detail__coverage-list">
          {coverageBars.map((bar) => (
            <CoverageBarRow key={bar.key} bar={bar} />
          ))}
        </div>
      </div>

      <div className="vault-version-detail__card vault-version-detail__card--warning">
        <div className="vault-version-detail__card-title-row">
          <AlertTriangle className="h-5 w-5 text-[var(--color-error)]" aria-hidden />
          <h3 className="vault-version-detail__card-title vault-version-detail__card-title--error">
            {copy.atsRisks}
          </h3>
        </div>
        {atsFlags.length ? (
          <ul className="vault-version-detail__ats-list">
            {atsFlags.map((flag) => (
              <li key={flag} className="vault-version-detail__ats-item">
                <Minus className="vault-version-detail__ats-icon" aria-hidden />
                <span>{flag}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="vault-version-detail__empty-note">{copy.noAtsRisks}</p>
        )}
      </div>

      <div className="vault-version-detail__card vault-version-detail__card--grow">
        <div className="vault-version-detail__card-title-row vault-version-detail__card-title-row--bordered">
          <Lightbulb className="h-5 w-5 text-[var(--color-primary)]" aria-hidden />
          <h3 className="vault-version-detail__card-title">{copy.optimization}</h3>
        </div>
        {suggestions.length ? (
          <ul className="vault-version-detail__suggestion-list">
            {suggestions.map((item) => (
              <li key={`${item.title}-${item.body}`} className="vault-version-detail__suggestion">
                <p className="vault-version-detail__suggestion-title">{item.title}</p>
                <p className="vault-version-detail__suggestion-body">{item.body}</p>
                {item.keywords?.length ? (
                  <div className="vault-version-detail__keyword-tags">
                    {item.keywords.map((keyword) => (
                      <span key={keyword} className="vault-version-detail__keyword-tag">
                        {keyword}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="vault-version-detail__empty-note">{copy.noSuggestions}</p>
        )}
      </div>
    </aside>
  );
}
