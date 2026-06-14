import React from 'react';
import { BadgeCheck, Brain, TrendingUp } from 'lucide-react';

import { SettingToggle } from './SettingToggle';
import { SectionHeading } from './SectionHeading';

type IntelligenceSettingsSectionProps = {
  includeMarketTrends: boolean;
  onIncludeMarketTrendsChange: (value: boolean) => void;
  benchmarkFaang: boolean;
  onBenchmarkFaangChange: (checked: boolean) => void;
};

export function IntelligenceSettingsSection({
  includeMarketTrends,
  onIncludeMarketTrendsChange,
  benchmarkFaang,
  onBenchmarkFaangChange,
}: IntelligenceSettingsSectionProps) {
  return (
    <section aria-labelledby="intelligence-settings-heading">
      <SectionHeading
        id="intelligence-settings-heading"
        title="Intelligence settings"
        icon={Brain}
        accent="tertiary"
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <SettingToggle
          id="market-trends-toggle"
          label="Include market trends"
          description="Weight questions toward in-demand skills this quarter"
          icon={<TrendingUp className="h-5 w-5" aria-hidden />}
          checked={includeMarketTrends}
          onChange={onIncludeMarketTrendsChange}
        />
        <SettingToggle
          id="faang-benchmark-toggle"
          label="Benchmark against FAANG standards"
          description="Compare depth and scope to top-tier bar-raiser loops"
          icon={<BadgeCheck className="h-5 w-5" aria-hidden />}
          checked={benchmarkFaang}
          onChange={onBenchmarkFaangChange}
        />
      </div>
    </section>
  );
}
