type FitScoreGaugeProps = {
  score: number;
  size?: 'sm' | 'lg';
};

export function FitScoreGauge({ score, size = 'lg' }: FitScoreGaugeProps) {
  const dim = size === 'lg' ? 'w-32 h-32' : 'w-10 h-10';
  const textClass = size === 'lg' ? 'type-display-lg' : 'font-mono text-[11px] font-bold';

  return (
    <div className={`relative ${dim} flex items-center justify-center shrink-0`}>
      <div className={`absolute inset-0 rounded-full application-fit-gauge shadow-luminous`} />
      <div className="absolute inset-2 flex flex-col items-center justify-center rounded-full bg-[var(--color-surface-container-lowest)]">
        <span className={`${textClass} text-[var(--color-on-surface)] leading-none`}>
          {score}
          {size === 'lg' ? <span className="type-headline-md">%</span> : null}
        </span>
      </div>
    </div>
  );
}
