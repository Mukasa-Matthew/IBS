import { StatusBadge } from './StatusBadge';

const HINTS: Record<string, string> = {
  SIMULATED: 'Mock provider — no Africa\'s Talking call was made',
  QUEUED: 'Accepted by Africa\'s Talking and queued for delivery',
  SENT: 'Accepted by Africa\'s Talking (not yet delivery-confirmed)',
  DELIVERED: 'Confirmed delivered via Africa\'s Talking delivery report',
  FAILED: 'Send failed or delivery report reported failure',
  PENDING: 'Notification not yet attempted',
  NOT_REQUIRED: 'Severity does not trigger SMS',
  SKIPPED: 'SMS intentionally skipped',
};

interface Props {
  status?: string | null;
  detail?: string | null;
  compact?: boolean;
}

export function SmsStatus({ status, detail, compact }: Props) {
  const value = (status || 'UNKNOWN').toUpperCase();
  return (
    <div className={compact ? '' : 'space-y-1'}>
      <StatusBadge label={`SMS ${value}`} value={value} />
      {!compact ? (
        <p className="text-[11px] leading-4 text-muted">
          {HINTS[value] || 'Provider lifecycle status'}
          {detail ? ` · ${detail}` : ''}
        </p>
      ) : null}
    </div>
  );
}
