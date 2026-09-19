import { stateTone, toneClasses } from '../lib/format';

interface Props {
  label: string;
  value?: string;
}

export function StatusBadge({ label, value }: Props) {
  const tone = stateTone(value || label);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-medium tracking-wide ${toneClasses(tone)}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
