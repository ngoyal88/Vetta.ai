import type { ButtonHTMLAttributes, ReactNode } from 'react';

type AuthSocialButtonProps = {
  icon: ReactNode;
  label: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function AuthSocialButton({ icon, label, className = '', ...props }: AuthSocialButtonProps) {
  return (
    <button type="button" className={`auth-social-btn group ${className}`.trim()} {...props}>
      <span className="opacity-90 transition-opacity group-hover:opacity-100">{icon}</span>
      {label}
    </button>
  );
}
