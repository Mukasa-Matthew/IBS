import type { ReactNode } from 'react';

interface Props {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, subtitle, actions, children, className = '' }: Props) {
  return (
    <section className={`rounded-xl border border-[#1e2a38] bg-[#121a24] ${className}`}>
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-[#1e2a38] px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-slate-100">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}
