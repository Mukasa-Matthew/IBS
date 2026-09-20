import type { ReactNode } from 'react';
import { Activity, ArrowDown, ArrowUp } from 'lucide-react';

interface ChartPoint {
  x: number;
  y: number;
}

function buildPoints(values: number[], width: number, height: number, padY = 8): ChartPoint[] {
  const series = values.length >= 2 ? values : [0, 0];
  const min = Math.min(...series);
  const max = Math.max(...series);
  const flat = max === min;
  return series.map((value, index) => {
    const x = (index / (series.length - 1)) * width;
    const y = flat
      ? height * 0.55
      : height - padY - ((value - min) / (max - min)) * (height - padY * 2);
    return { x, y };
  });
}

function toPath(points: ChartPoint[]) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

interface AreaTrendProps {
  values: number[];
  stroke?: string;
  fillId?: string;
  fillFrom?: string;
  fillTo?: string;
  className?: string;
  showDots?: boolean;
}

/** Full-bleed area chart with connected dots — matches KPI card reference style. */
export function AreaTrend({
  values,
  stroke = '#ef8d22',
  fillId = 'areaFill',
  fillFrom = 'rgba(239,141,34,0.32)',
  fillTo = 'rgba(239,141,34,0.02)',
  className = '',
  showDots = true,
}: AreaTrendProps) {
  const width = 360;
  const height = 110;
  const points = buildPoints(values, width, height);
  const linePath = toPath(points);
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`block w-full ${className}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillFrom} />
          <stop offset="100%" stopColor={fillTo} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${fillId})`} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {showDots
        ? points.map((point, index) => (
            <circle
              key={`${point.x}-${index}`}
              cx={point.x}
              cy={point.y}
              r="3.5"
              fill="#ffffff"
              stroke={stroke}
              strokeWidth="2"
            />
          ))
        : null}
    </svg>
  );
}

/** Compact sparkline for tables / secondary widgets. */
export function Sparkline({
  values,
  stroke = '#ef8d22',
  fill = 'rgba(239,141,34,0.16)',
  className = '',
}: {
  values: number[];
  stroke?: string;
  fill?: string;
  className?: string;
}) {
  const width = 120;
  const height = 36;
  if (values.length < 2) {
    return <svg viewBox={`0 0 ${width} ${height}`} className={className} />;
  }
  const points = buildPoints(values, width, height, 4);
  const linePath = toPath(points);
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <path d={areaPath} fill={fill} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

interface BarChartProps {
  values: number[];
  labels?: string[];
  highlightIndex?: number;
  className?: string;
}

export function LiveBarChart({ values, labels = [], highlightIndex, className = '' }: BarChartProps) {
  const max = Math.max(1, ...values);
  return (
    <div className={`flex h-44 items-end gap-2 ${className}`}>
      {values.map((value, index) => {
        const height = `${Math.max(8, (value / max) * 100)}%`;
        const active = highlightIndex === index;
        return (
          <div key={`${labels[index] || index}-${value}`} className="flex flex-1 flex-col items-center gap-2">
            <div className="relative flex h-36 w-full items-end justify-center">
              {active ? (
                <span className="absolute -top-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-white">
                  {value}
                </span>
              ) : null}
              <div
                className={`w-full max-w-8 rounded-t-xl transition-all duration-500 ${
                  active ? 'bg-brand' : value > 70 ? 'bg-accent' : 'bg-accent-soft'
                }`}
                style={{ height }}
                title={String(value)}
              />
            </div>
            <span className="text-[10px] text-muted">{labels[index] || index + 1}</span>
          </div>
        );
      })}
    </div>
  );
}

const THEMES = {
  accent: {
    stroke: '#ef8d22',
    fillFrom: 'rgba(239,141,34,0.32)',
    fillTo: 'rgba(239,141,34,0.02)',
    trend: 'text-accent',
    iconBg: 'bg-accent-soft',
    iconFg: 'text-accent-deep',
  },
  brand: {
    stroke: '#09733f',
    fillFrom: 'rgba(9,115,63,0.28)',
    fillTo: 'rgba(9,115,63,0.02)',
    trend: 'text-brand',
    iconBg: 'bg-brand-soft',
    iconFg: 'text-brand',
  },
  rose: {
    stroke: '#c0382b',
    fillFrom: 'rgba(192,56,43,0.22)',
    fillTo: 'rgba(192,56,43,0.02)',
    trend: 'text-fail',
    iconBg: 'bg-fail/10',
    iconFg: 'text-fail',
  },
  /** Aliases for existing call sites */
  violet: {
    stroke: '#ef8d22',
    fillFrom: 'rgba(239,141,34,0.32)',
    fillTo: 'rgba(239,141,34,0.02)',
    trend: 'text-accent',
    iconBg: 'bg-accent-soft',
    iconFg: 'text-accent-deep',
  },
  forest: {
    stroke: '#09733f',
    fillFrom: 'rgba(9,115,63,0.28)',
    fillTo: 'rgba(9,115,63,0.02)',
    trend: 'text-brand',
    iconBg: 'bg-brand-soft',
    iconFg: 'text-brand',
  },
} as const;

interface MetricCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  series: number[];
  /** Kept for call-site compat; light cards always use the reference layout. */
  emphasis?: boolean;
  unit?: string;
  icon?: ReactNode;
  tone?: keyof typeof THEMES;
}

export function MetricCard({
  label,
  value,
  delta,
  deltaPositive = true,
  series,
  unit,
  icon,
  tone,
}: MetricCardProps) {
  const palette = THEMES[tone || (deltaPositive ? 'accent' : 'rose')];
  const fillId = `metric-fill-${label.replace(/\W+/g, '-').toLowerCase()}`;
  const chartValues =
    series.length >= 2 ? series : series.length === 1 ? [series[0], series[0]] : [0, 0];
  const rising =
    chartValues.length >= 2 && chartValues[chartValues.length - 1] >= chartValues[chartValues.length - 2];

  return (
    <div className="flex flex-col overflow-hidden rounded-[22px] border border-line bg-surface shadow-[0_10px_30px_rgba(9,115,63,0.08)]">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${palette.iconBg} ${palette.iconFg}`}>
          {icon || <Activity className="h-4 w-4" />}
        </span>
      </div>

      <div className="px-5 pt-2">
        <p className="text-[34px] font-semibold leading-none tracking-tight text-ink">
          {value}
          {unit ? <span className="ml-1.5 text-base font-medium text-muted">{unit}</span> : null}
        </p>
        {delta ? (
          <p className={`mt-2.5 flex items-center gap-1 text-[13px] font-medium ${palette.trend}`}>
            {rising ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
            <span>{delta}</span>
          </p>
        ) : null}
      </div>

      <div className="mt-4 h-[96px] w-full">
        <AreaTrend
          values={chartValues}
          stroke={palette.stroke}
          fillId={fillId}
          fillFrom={palette.fillFrom}
          fillTo={palette.fillTo}
          className="h-full"
        />
      </div>
    </div>
  );
}
