import React from 'react';
import { interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { SunriseIcon } from '../components/SunriseIcon';
import { colors, font } from '../theme';

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const titleOpacity = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: 'clamp' });
  const subtitleOpacity = interpolate(frame, [25, 50], [0, 1], { extrapolateRight: 'clamp' });
  const taglineOpacity = interpolate(frame, [40, 65], [0, 1], { extrapolateRight: 'clamp' });
  const taglineY = interpolate(frame, [40, 65], [12, 0], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #1c7ed6 0%, #0c4a8a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: font.sans,
        gap: 16,
      }}
    >
      <div style={{ transform: `scale(${logoScale})` }}>
        <SunriseIcon size={96} sunColor="#ffd43b" rayColor="#fff176" skyColor="rgba(255,255,255,0.9)" />
      </div>

      <div
        style={{
          fontSize: 56,
          fontWeight: 800,
          color: '#fff',
          opacity: titleOpacity,
          letterSpacing: -1,
        }}
      >
        Aurora
      </div>

      <div
        style={{
          fontSize: 18,
          color: 'rgba(255,255,255,0.85)',
          opacity: subtitleOpacity,
          fontWeight: 500,
        }}
      >
        Análise de Mortalidade Neonatal — OMS
      </div>

      <div
        style={{
          marginTop: 24,
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
          display: 'flex',
          gap: 32,
        }}
      >
        {['Text-to-SQL', 'Gráficos automáticos', 'Histórico persistente'].map((feat) => (
          <div
            key={feat}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 20,
              padding: '6px 16px',
              fontSize: 13,
              color: '#fff',
              fontWeight: 500,
            }}
          >
            {feat}
          </div>
        ))}
      </div>
    </div>
  );
};
