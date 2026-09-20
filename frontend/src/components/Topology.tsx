import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { TopologyLink, TopologyNode } from '../types';
import { stateTone } from '../lib/format';

interface Props {
  nodes: TopologyNode[];
  links: TopologyLink[];
  onSelect?: (target: { kind: 'node' | 'link'; item: TopologyNode | TopologyLink }) => void;
  /** Extra-large canvas for Operations / Network hero views */
  large?: boolean;
}

/** High-contrast strokes for dark topology canvas */
function topoToneHex(tone: string) {
  switch (tone) {
    case 'ok':
      return '#5eead4';
    case 'warn':
      return '#ef8d22';
    case 'fail':
      return '#fb7185';
    default:
      return '#94a3b8';
  }
}

function layoutPositions(nodes: TopologyNode[], large: boolean) {
  const sites = nodes.filter((node) => node.type === 'site');
  const count = Math.max(1, sites.length);
  const colWidth = large ? 200 : 160;
  const width = Math.max(large ? 1200 : 960, count * colWidth);
  const height = large ? 620 : 480;
  const gap = width / (count + 1);

  const backboneY = large ? { internet: 48, upstream: 130, core: 212 } : { internet: 36, upstream: 100, core: 164 };
  const siteY = large ? 340 : 270;
  const oltY = large ? 440 : 350;
  const custY = large ? 540 : 430;

  const positions: Record<string, { x: number; y: number }> = {};
  const midX = width / 2;
  positions.INTERNET = { x: midX, y: backboneY.internet };
  positions.UPSTREAM = { x: midX, y: backboneY.upstream };
  positions.CORE = { x: midX, y: backboneY.core };

  sites.forEach((site, index) => {
    const x = gap * (index + 1);
    positions[site.id] = { x, y: siteY };
    positions[`OLT_${site.id}`] = { x, y: oltY };
    positions[`CUST_${site.id}`] = { x, y: custY };
  });

  return { positions, width, height, large };
}

export function Topology({ nodes, links, onSelect, large = false }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const nodeMap = useMemo(() => Object.fromEntries(nodes.map((node) => [node.id, node])), [nodes]);
  const { positions, width, height } = useMemo(() => layoutPositions(nodes, large), [nodes, large]);

  const nodeW = large ? 168 : 144;
  const nodeH = large ? 58 : 52;
  const titleSize = large ? 12 : 11;
  const subSize = large ? 10 : 9;

  useEffect(() => {
    function sync() {
      setFullscreen(document.fullscreenElement === rootRef.current);
    }
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  async function toggleFullscreen() {
    const el = rootRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen unavailable', error);
    }
  }

  return (
    <section
      ref={rootRef}
      className={`flex h-full flex-col bg-[var(--ib-topo-bg)] p-5 text-[var(--ib-topo-label)] md:p-6 ${
        fullscreen ? 'h-screen w-screen overflow-auto p-6 md:p-8' : ''
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-white md:text-base">Network topology</h2>
          <p className="text-[11px] text-[var(--ib-topo-muted)] md:text-xs">
            Internet → upstream → core → {nodes.filter((n) => n.type === 'site').length} site racks → OLT → customers
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2 text-[10px] font-medium uppercase tracking-wide text-[var(--ib-topo-muted)]">
            <Legend color="#5eead4" label="Healthy" />
            <Legend color="#ef8d22" label="Degraded" />
            <Legend color="#fb7185" label="Offline" />
            <Legend color="#94a3b8" label="Unknown" />
          </div>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-white/20"
            title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen topology'}
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {fullscreen ? 'Exit' : 'Fullscreen'}
          </button>
        </div>
      </div>
      <div
        className={`overflow-x-auto rounded-2xl bg-black/25 ring-1 ring-white/10 ${
          fullscreen ? 'min-h-0 flex-1' : ''
        }`}
        onDoubleClick={(event) => {
          if ((event.target as Element).closest('[data-topo-node],[data-topo-link]')) return;
          void toggleFullscreen();
        }}
        title="Double-click empty area for fullscreen"
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={`w-full ${
            fullscreen
              ? 'min-h-[calc(100vh-7rem)] min-w-[980px]'
              : large
                ? 'min-h-[560px] min-w-[980px]'
                : 'min-h-[400px] min-w-[720px]'
          }`}
          role="img"
          aria-label="ISP network topology"
        >
          {links.map((link) => {
            const from = positions[link.from];
            const to = positions[link.to];
            if (!from || !to) return null;
            const color = topoToneHex(stateTone(link.state));
            const active = selectedId === link.id;
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            return (
              <g
                key={link.id}
                data-topo-link
                className="cursor-pointer"
                onClick={() => {
                  setSelectedId(link.id);
                  onSelect?.({ kind: 'link', item: link });
                }}
              >
                <line
                  x1={from.x}
                  y1={from.y + nodeH / 2 - 4}
                  x2={to.x}
                  y2={to.y - nodeH / 2 + 4}
                  stroke={color}
                  strokeWidth={active ? 3.8 : large ? 2.8 : 2.4}
                  strokeOpacity={0.95}
                  strokeDasharray={link.state === 'FAILURE' ? '6 4' : link.state === 'UNKNOWN' ? '2 4' : undefined}
                  className={link.state === 'FAILURE' ? 'animate-pulse' : undefined}
                />
                {link.label ? (
                  <text
                    x={midX + 6}
                    y={midY}
                    fill="var(--ib-topo-label)"
                    fontSize={large ? 11 : 10}
                    fontWeight={500}
                    fontFamily="IBM Plex Sans"
                    opacity={0.92}
                  >
                    {link.label.length > 24 ? `${link.label.slice(0, 22)}…` : link.label}
                  </text>
                ) : null}
              </g>
            );
          })}
          {Object.entries(positions).map(([id, pos]) => {
            const node = nodeMap[id] || { id, label: id, state: 'UNKNOWN' as const };
            const color = topoToneHex(stateTone(node.state));
            const active = selectedId === id;
            const tech = node.technician;
            return (
              <g
                key={id}
                data-topo-node
                className="cursor-pointer"
                onClick={() => {
                  setSelectedId(id);
                  onSelect?.({ kind: 'node', item: node });
                }}
              >
                <rect
                  x={pos.x - nodeW / 2}
                  y={pos.y - nodeH / 2}
                  width={nodeW}
                  height={nodeH}
                  rx="12"
                  fill="var(--ib-topo-node)"
                  stroke={color}
                  strokeWidth={active ? 3 : 2.2}
                />
                <circle cx={pos.x - nodeW / 2 + 16} cy={pos.y} r={large ? 6 : 5} fill={color} />
                <text
                  x={pos.x - nodeW / 2 + 28}
                  y={pos.y - 2}
                  fill="var(--ib-topo-label)"
                  fontSize={titleSize}
                  fontWeight={600}
                  fontFamily="IBM Plex Sans"
                >
                  {node.label.length > (large ? 20 : 18)
                    ? `${node.label.slice(0, large ? 18 : 16)}…`
                    : node.label}
                </text>
                <text
                  x={pos.x - nodeW / 2 + 28}
                  y={pos.y + 14}
                  fill={color}
                  fontSize={subSize}
                  fontWeight={600}
                  fontFamily="IBM Plex Sans"
                >
                  {(node.type || 'node').toUpperCase()} · {node.state}
                </text>
                <title>
                  {`${node.label} — ${node.state}${node.service_area ? ` (${node.service_area})` : ''}${
                    tech ? ` · ${tech}` : ''
                  }`}
                </title>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white/30" style={{ background: color }} />
      {label}
    </span>
  );
}
