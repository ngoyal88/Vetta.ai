import type { ReactElement } from 'react';

type PageLoadingVariant =
  | 'shell'
  | 'list'
  | 'split'
  | 'metrics'
  | 'cards'
  | 'panel'
  | 'builder-workspace'
  | 'version-detail-insights'
  | 'fullscreen';

export type PageLoadingStateProps = {
  variant?: PageLoadingVariant;
  label?: string;
  fullScreen?: boolean;
  minHeightClassName?: string;
  className?: string;
};

function ShimmerBar({ className = '' }: { className?: string }) {
  return <div className={`app-shimmer ${className}`.trim()} aria-hidden />;
}

function ShellSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-1">
      <div className="space-y-3">
        <ShimmerBar className="h-8 w-56 max-w-[70%]" />
        <ShimmerBar className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ShimmerBar className="h-36" />
        <ShimmerBar className="h-36" />
      </div>
      <ShimmerBar className="h-48" />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      <div className="hidden gap-4 px-2 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
        <ShimmerBar className="h-3" />
        <ShimmerBar className="h-3" />
        <ShimmerBar className="h-3 w-16 justify-self-end" />
      </div>
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="glass-panel grid gap-4 rounded-xl p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-center"
        >
          <div className="space-y-2">
            <ShimmerBar className="h-4 w-48 max-w-full" />
            <ShimmerBar className="h-3 w-32 max-w-[80%]" />
          </div>
          <ShimmerBar className="h-4 w-24" />
          <ShimmerBar className="h-8 w-20 justify-self-start md:justify-self-end" />
        </div>
      ))}
    </div>
  );
}

function SplitSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="glass-panel space-y-3 rounded-xl p-4">
            <ShimmerBar className="h-4 w-40" />
            <ShimmerBar className="h-3 w-full" />
            <ShimmerBar className="h-3 w-2/3" />
          </div>
        ))}
      </div>
      <div className="glass-panel space-y-4 rounded-xl p-5">
        <ShimmerBar className="h-6 w-48" />
        <ShimmerBar className="h-4 w-full" />
        <ShimmerBar className="h-4 w-5/6" />
        <ShimmerBar className="h-32 w-full" />
        <ShimmerBar className="h-10 w-36" />
      </div>
    </div>
  );
}

function MetricsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="glass-panel space-y-3 rounded-xl p-5">
            <ShimmerBar className="h-3 w-20" />
            <ShimmerBar className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ShimmerBar className="h-72" />
        <ShimmerBar className="h-72" />
      </div>
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="glass-panel space-y-4 rounded-xl p-5">
          <ShimmerBar className="h-5 w-24" />
          <ShimmerBar className="h-4 w-full" />
          <ShimmerBar className="h-4 w-4/5" />
          <ShimmerBar className="h-28 w-full" />
          <div className="flex gap-2">
            <ShimmerBar className="h-9 w-20" />
            <ShimmerBar className="h-9 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="glass-panel space-y-4 rounded-xl p-5">
      <ShimmerBar className="h-6 w-40" />
      <ShimmerBar className="h-4 w-full" />
      <ShimmerBar className="h-4 w-5/6" />
      <ShimmerBar className="h-32 w-full" />
      <ShimmerBar className="h-10 w-36" />
    </div>
  );
}

function BuilderWorkspaceSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr),minmax(0,0.95fr)]">
      <div className="space-y-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="glass-panel space-y-3 rounded-xl p-4">
            <ShimmerBar className="h-5 w-32" />
            <ShimmerBar className="h-10 w-full" />
            <ShimmerBar className="h-10 w-full" />
          </div>
        ))}
      </div>
      <PanelSkeleton />
    </div>
  );
}

function VersionDetailInsightsSkeleton() {
  return (
    <div className="vault-version-detail__insights glass-panel space-y-5 p-5">
      <ShimmerBar className="mx-auto h-24 w-24 rounded-full" />
      <ShimmerBar className="h-4 w-full" />
      <ShimmerBar className="h-4 w-4/5" />
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="space-y-2">
          <ShimmerBar className="h-3 w-24" />
          <ShimmerBar className="h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

function FullscreenSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-6 px-4 text-center">
      <ShimmerBar className="h-14 w-14 rounded-full" />
      <div className="w-full space-y-3">
        <ShimmerBar className="mx-auto h-6 w-48" />
        <ShimmerBar className="mx-auto h-4 w-64 max-w-full" />
      </div>
      <ShimmerBar className="h-40 w-full rounded-2xl" />
    </div>
  );
}

const VARIANTS: Record<PageLoadingVariant, () => ReactElement> = {
  shell: ShellSkeleton,
  list: ListSkeleton,
  split: SplitSkeleton,
  metrics: MetricsSkeleton,
  cards: CardsSkeleton,
  panel: PanelSkeleton,
  'builder-workspace': BuilderWorkspaceSkeleton,
  'version-detail-insights': VersionDetailInsightsSkeleton,
  fullscreen: FullscreenSkeleton,
};

export default function PageLoadingState({
  variant = 'shell',
  label,
  fullScreen = false,
  minHeightClassName = 'min-h-[40vh]',
  className = '',
}: PageLoadingStateProps) {
  const Skeleton = VARIANTS[variant];

  return (
    <div
      className={[
        'w-full',
        fullScreen ? 'flex min-h-screen items-center justify-center px-4 py-10' : minHeightClassName,
        className,
      ].join(' ')}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full">
        <Skeleton />
        {label ? (
          <p className="type-body-sm mt-6 text-center text-[var(--color-on-surface-variant)]">{label}</p>
        ) : (
          <span className="sr-only">Loading</span>
        )}
      </div>
    </div>
  );
}
