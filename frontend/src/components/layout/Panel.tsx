import type { ReactNode } from 'react';

interface Props {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  dark?: boolean;
}

export function Panel({ title, subtitle, actions, children, className = '', dark = false }: Props) {
  return (
    <section
      className={`rounded-3xl border shadow-[0_18px_40px_rgba(9,115,63,0.08)] ${
        dark
          ? 'border-brand-deep bg-brand text-sidebar-ink'
          : 'border-line bg-surface text-ink'
      } ${className}`}
    >
      {title ? (
        <div
          className={`flex items-center justify-between gap-3 border-b px-5 py-3 ${
            dark ? 'border-white/15' : 'border-line'
          }`}
        >
          <div>
            <h2 className={`text-sm font-semibold tracking-wide ${dark ? 'text-white' : 'text-ink'}`}>
              {title}
            </h2>
            {subtitle ? (
              <p className={`mt-0.5 text-xs ${dark ? 'text-sidebar-muted' : 'text-muted'}`}>{subtitle}</p>
            ) : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}
