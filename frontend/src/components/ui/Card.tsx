import { type ReactNode } from 'react';

type CardProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Card({ title, description, actions, children, className = '' }: CardProps) {
  return (
    <div className={`card ${className}`}>
      {(title || description || actions) && (
        <div className="flex flex-col gap-1 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && <h3 className="text-card font-semibold text-ink">{title}</h3>}
            {description && <p className="mt-1 text-body text-ink-muted">{description}</p>}
          </div>
          {actions && <div className="mt-3 flex items-center gap-2 sm:mt-0">{actions}</div>}
        </div>
      )}
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}
