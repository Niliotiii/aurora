import React from 'react';
import { colors } from '../theme';

const DATA = [
  { year: 2000, rate: 18.3 },
  { year: 2003, rate: 15.8 },
  { year: 2006, rate: 13.5 },
  { year: 2009, rate: 11.8 },
  { year: 2012, rate: 10.3 },
  { year: 2015, rate: 9.4 },
  { year: 2017, rate: 8.5 },
];

export const LineChart: React.FC<{
  progress: number; // 0 → 1: how much of the line is drawn
  opacity?: number;
}> = ({ progress, opacity = 1 }) => {
  const W = 420;
  const H = 200;
  const PAD = { top: 24, right: 20, bottom: 40, left: 52 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const minYear = DATA[0].year;
  const maxYear = DATA[DATA.length - 1].year;
  const minRate = 6;
  const maxRate = 22;

  const xScale = (year: number) =>
    PAD.left + ((year - minYear) / (maxYear - minYear)) * innerW;
  const yScale = (rate: number) =>
    PAD.top + innerH - ((rate - minRate) / (maxRate - minRate)) * innerH;

  const points = DATA.map((d) => ({ x: xScale(d.year), y: yScale(d.rate), ...d }));

  // Build full polyline path
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Total path length approximation for stroke-dasharray animation
  const totalLen = points.reduce((sum, p, i) => {
    if (i === 0) return 0;
    const prev = points[i - 1];
    return sum + Math.hypot(p.x - prev.x, p.y - prev.y);
  }, 0);
  const dashOffset = totalLen * (1 - progress);

  // Grid Y lines
  const yTicks = [8, 10, 12, 14, 16, 18, 20];

  return (
    <div style={{ opacity, transition: 'opacity 0.3s' }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: colors.text,
          textAlign: 'center',
          marginBottom: 6,
        }}
      >
        Taxa de mortalidade neonatal ao longo do tempo (estimativas OMS)
      </div>
      <svg width={W} height={H}>
        {/* Grid lines */}
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              y1={yScale(t)}
              x2={W - PAD.right}
              y2={yScale(t)}
              stroke={colors.chartGrid}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={yScale(t) + 4}
              textAnchor="end"
              fontSize={10}
              fill={colors.chartAxisText}
            >
              {t}
            </text>
          </g>
        ))}

        {/* X axis labels */}
        {DATA.map((d) => (
          <text
            key={d.year}
            x={xScale(d.year)}
            y={H - PAD.bottom + 16}
            textAnchor="middle"
            fontSize={10}
            fill={colors.chartAxisText}
          >
            {d.year}
          </text>
        ))}

        {/* Axis labels */}
        <text
          x={PAD.left - 38}
          y={PAD.top + innerH / 2}
          textAnchor="middle"
          fontSize={10}
          fill={colors.textMuted}
          transform={`rotate(-90, ${PAD.left - 38}, ${PAD.top + innerH / 2})`}
        >
          Taxa por 1.000 nascidos vivos
        </text>
        <text
          x={PAD.left + innerW / 2}
          y={H - 4}
          textAnchor="middle"
          fontSize={10}
          fill={colors.textMuted}
        >
          Ano
        </text>

        {/* Animated line */}
        <path
          d={linePath}
          fill="none"
          stroke={colors.chartLine}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={totalLen}
          strokeDashoffset={dashOffset}
        />

        {/* Points (appear as line progresses) */}
        {points.map((p, i) => {
          const pointProgress = (i + 1) / points.length;
          if (progress < pointProgress - 0.05) return null;
          const pOpacity = Math.min(1, (progress - (pointProgress - 0.05)) / 0.1);
          return (
            <circle
              key={p.year}
              cx={p.x}
              cy={p.y}
              r={4}
              fill={colors.surface}
              stroke={colors.chartPoint}
              strokeWidth={2}
              opacity={pOpacity}
            />
          );
        })}
      </svg>
    </div>
  );
};
