import React from 'react';
import { colors } from '../theme';

const DATA = [
  { label: 'Prematuridade', rate: 2.49 },
  { label: 'Anomalias congênitas', rate: 1.76 },
  { label: 'Outras condições', rate: 1.56 },
  { label: 'Asfixia perinatal', rate: 1.27 },
  { label: 'Sepse neonatal', rate: 1.18 },
];

const BAR_COLORS = ['#1c7ed6', '#2f9e44', '#e67700', '#c92a2a', '#7048e8'];

export const BarChart: React.FC<{
  progress: number; // 0 → 1
  opacity?: number;
}> = ({ progress, opacity = 1 }) => {
  const W = 420;
  const H = 210;
  const PAD = { top: 28, right: 20, bottom: 36, left: 130 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const maxRate = 3.0;
  const xScale = (rate: number) => PAD.left + (rate / maxRate) * innerW;
  const barHeight = Math.floor((innerH / DATA.length) * 0.62);
  const rowH = innerH / DATA.length;

  const xTicks = [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0];

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
        5 maiores causas — Brasil 2017 (mortes por 1.000 nascidos vivos)
      </div>
      <svg width={W} height={H}>
        {/* Grid lines */}
        {xTicks.map((t) => (
          <g key={t}>
            <line
              x1={xScale(t)}
              y1={PAD.top}
              x2={xScale(t)}
              y2={H - PAD.bottom}
              stroke={colors.chartGrid}
              strokeWidth={1}
            />
            <text
              x={xScale(t)}
              y={H - PAD.bottom + 14}
              textAnchor="middle"
              fontSize={9}
              fill={colors.chartAxisText}
            >
              {t.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Bars */}
        {DATA.map((d, i) => {
          const y = PAD.top + i * rowH + (rowH - barHeight) / 2;
          const barProgress = Math.min(1, Math.max(0, (progress - i * 0.15) / 0.55));
          const barW = xScale(d.rate * barProgress) - PAD.left;

          return (
            <g key={d.label}>
              {/* Y label */}
              <text
                x={PAD.left - 8}
                y={y + barHeight / 2 + 4}
                textAnchor="end"
                fontSize={10}
                fill={colors.text}
                fontWeight={500}
              >
                {d.label}
              </text>
              {/* Bar */}
              <rect
                x={PAD.left}
                y={y}
                width={barW}
                height={barHeight}
                fill={BAR_COLORS[i]}
                rx={3}
                opacity={0.88}
              />
              {/* Value label */}
              {barProgress > 0.85 && (
                <text
                  x={PAD.left + barW + 5}
                  y={y + barHeight / 2 + 4}
                  fontSize={10}
                  fill={colors.text}
                  fontWeight={600}
                  opacity={(barProgress - 0.85) / 0.15}
                >
                  {d.rate.toFixed(2)}
                </text>
              )}
            </g>
          );
        })}

        {/* X axis label */}
        <text
          x={PAD.left + innerW / 2}
          y={H - 4}
          textAnchor="middle"
          fontSize={9}
          fill={colors.textMuted}
        >
          Taxa por 1.000 nascidos vivos
        </text>
      </svg>
    </div>
  );
};
