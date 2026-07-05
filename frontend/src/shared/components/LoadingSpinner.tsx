type LoadingSpinnerProps = {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  fullScreen?: boolean;
  minHeightClassName?: string;
  className?: string;
};

const SIZE_CLASSES: Record<NonNullable<LoadingSpinnerProps['size']>, string> = {
  sm: 'h-8 w-8 border-2',
  md: 'h-10 w-10 border-2',
  lg: 'h-12 w-12 border-[3px]',
};

export default function LoadingSpinner({
  size = 'md',
  label,
  fullScreen = false,
  minHeightClassName = 'min-h-[40vh]',
  className = '',
}: LoadingSpinnerProps) {
  return (
    <div
      className={[
        'flex items-center justify-center',
        fullScreen ? 'min-h-screen' : minHeightClassName,
        className,
      ].join(' ')}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className={[
            'animate-spin rounded-full border-[color-mix(in_srgb,var(--color-on-surface)_10%,transparent)] border-t-[var(--color-primary)] border-r-[var(--color-primary-container)] shadow-[0_0_24px_color-mix(in_srgb,var(--color-primary)_12%,transparent)]',
            SIZE_CLASSES[size],
          ].join(' ')}
          aria-hidden="true"
        />
        {label ? (
          <p className="type-body-md text-[var(--color-on-surface-variant)]" aria-live="polite">
            {label}
          </p>
        ) : null}
      </div>
    </div>
  );
}
