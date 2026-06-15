import React from 'react';

export const SunriseIcon: React.FC<{
  size?: number;
  sunColor?: string;
  skyColor?: string;
  rayColor?: string;
}> = ({
  size = 48,
  sunColor = '#f59f00',
  skyColor = '#1c7ed6',
  rayColor = '#ffd43b',
}) => {
  const s = size;
  const cx = s / 2;       // center X
  const horizonY = s * 0.62; // horizon line Y
  const sunR = s * 0.18;  // sun radius
  const sunCY = horizonY; // sun sits on horizon

  // Rays: 7 rays fanning above the horizon
  const rayCount = 7;
  const rayInner = sunR + s * 0.04;
  const rayOuter = sunR + s * 0.22;
  const rayAngles = [-60, -40, -20, 0, 20, 40, 60]; // degrees from vertical

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Sky gradient background circle (subtle) */}
      <defs>
        <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={sunColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={sunColor} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft glow behind sun */}
      <ellipse
        cx={cx}
        cy={sunCY}
        rx={sunR * 2.2}
        ry={sunR * 2.2}
        fill="url(#sunGlow)"
      />

      {/* Rays */}
      {rayAngles.map((angleDeg, i) => {
        const angleRad = (angleDeg * Math.PI) / 180;
        const x1 = cx + rayInner * Math.sin(angleRad);
        const y1 = sunCY - rayInner * Math.cos(angleRad);
        const x2 = cx + rayOuter * Math.sin(angleRad);
        const y2 = sunCY - rayOuter * Math.cos(angleRad);
        const strokeW = i === 3 ? s * 0.038 : s * 0.026; // center ray slightly thicker
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={rayColor}
            strokeWidth={strokeW}
            strokeLinecap="round"
            opacity={0.9 - Math.abs(angleDeg) * 0.004}
          />
        );
      })}

      {/* Sun semicircle (only top half visible above horizon) */}
      <clipPath id="aboveHorizon">
        <rect x={0} y={0} width={s} height={horizonY} />
      </clipPath>
      <circle
        cx={cx}
        cy={sunCY}
        r={sunR}
        fill={sunColor}
        clipPath="url(#aboveHorizon)"
      />

      {/* Horizon line */}
      <line
        x1={s * 0.06}
        y1={horizonY}
        x2={s * 0.94}
        y2={horizonY}
        stroke={skyColor}
        strokeWidth={s * 0.045}
        strokeLinecap="round"
      />

      {/* Two small horizon bands (horizon glow) */}
      <line
        x1={s * 0.14}
        y1={horizonY + s * 0.1}
        x2={s * 0.86}
        y2={horizonY + s * 0.1}
        stroke={skyColor}
        strokeWidth={s * 0.032}
        strokeLinecap="round"
        opacity={0.55}
      />
      <line
        x1={s * 0.24}
        y1={horizonY + s * 0.19}
        x2={s * 0.76}
        y2={horizonY + s * 0.19}
        stroke={skyColor}
        strokeWidth={s * 0.022}
        strokeLinecap="round"
        opacity={0.3}
      />
    </svg>
  );
};
