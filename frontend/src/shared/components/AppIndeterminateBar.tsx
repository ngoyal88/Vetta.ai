type AppIndeterminateBarProps = {
  active?: boolean;
};

export default function AppIndeterminateBar({ active = true }: AppIndeterminateBarProps) {
  if (!active) return null;

  return (
    <div className="app-indeterminate-bar" aria-hidden>
      <div className="app-indeterminate-bar__track" />
    </div>
  );
}
