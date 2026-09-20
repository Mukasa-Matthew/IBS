import { stateTone } from '../lib/format';

interface Props {
  label: string;
  value?: string;
}

const TONE: Record<string, string> = {
  ok: 'text-brand bg-brand-soft border-brand/25 dark:text-ok dark:bg-brand/20 dark:border-ok/30',
  warn: 'text-accent-deep bg-accent-soft border-accent/35 dark:text-accent dark:bg-accent/15 dark:border-accent/40',
  fail: 'text-fail bg-fail/10 border-fail/25',
  neutral: 'text-muted bg-surface-2 border-line',
};

export function StatusBadge({ label, value }: Props) {
  const tone = stateTone(value || label);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${TONE[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
