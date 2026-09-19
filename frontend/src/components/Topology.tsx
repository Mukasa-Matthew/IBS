import type { TopologyLink, TopologyNode } from '../types';
import { stateTone, toneHex } from '../lib/format';

interface Props {
  nodes: TopologyNode[];
  links: TopologyLink[];
}

const POSITIONS: Record<string, { x: number; y: number }> = {
  INTERNET: { x: 300, y: 42 },
  CORE: { x: 300, y: 132 },
  MUKONO_A: { x: 128, y: 242 },
  MUKONO_B: { x: 472, y: 242 },
};

export function Topology({ nodes, links }: Props) {
  const nodeMap = Object.fromEntries(nodes.map((node) => [node.id, node]));

  return (
    <section className="flex h-full flex-col rounded-xl border border-[#1e2a38] bg-[#121a24] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-slate-200">Network topology</h2>
        <p className="text-[11px] text-slate-500">Derived from simulated edge observations</p>
      </div>
      <svg viewBox="0 0 600 300" className="h-full min-h-[280px] w-full">
        {links.map((link) => {
          const from = POSITIONS[link.from];
          const to = POSITIONS[link.to];
          if (!from || !to) return null;
          return (
            <line
              key={link.id}
              x1={from.x}
              y1={from.y + 20}
              x2={to.x}
              y2={to.y - 22}
              stroke={toneHex(stateTone(link.state))}
              strokeWidth="2"
            />
          );
        })}
        {Object.entries(POSITIONS).map(([id, pos]) => {
          const node = nodeMap[id] || { id, label: id, state: 'UNKNOWN' };
          const color = toneHex(stateTone(node.state));
          return (
            <g key={id}>
              <rect
                x={pos.x - 78}
                y={pos.y - 28}
                width="156"
                height="56"
                rx="8"
                fill="#0b1118"
                stroke={color}
                strokeWidth="1.6"
              />
              <circle cx={pos.x - 58} cy={pos.y} r="6" fill={color} />
              <text x={pos.x - 44} y={pos.y - 4} fill="#e8eef5" fontSize="13" fontFamily="IBM Plex Sans">
                {node.label}
              </text>
              <text x={pos.x - 44} y={pos.y + 14} fill={color} fontSize="10" fontFamily="IBM Plex Sans">
                {node.state}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
