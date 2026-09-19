import type { EventItem } from '../types';
import { formatClock } from '../lib/format';

interface Props {
  events: EventItem[];
}

export function EventFeed({ events }: Props) {
  return (
    <section className="flex h-full min-h-[220px] flex-col rounded-lg border border-[#1e2a38] bg-[#121a24] p-4">
      <h2 className="mb-3 text-sm font-semibold tracking-wide">Event stream</h2>
      <div className="flex-1 overflow-auto font-mono text-[11px] leading-5">
        {events.length === 0 ? (
          <p className="font-sans text-sm text-slate-500">Waiting for monitoring observations.</p>
        ) : (
          events.map((event) => (
            <div key={event.id} className="grid grid-cols-[72px_1fr] gap-2 border-b border-[#1a2430] py-1.5">
              <span className="text-slate-500">{formatClock(event.occurred_at)}</span>
              <span className="text-slate-200">{event.message}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
