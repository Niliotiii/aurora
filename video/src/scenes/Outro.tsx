import React from 'react';
import { interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { SunriseIcon } from '../components/SunriseIcon';
import { colors, font } from '../theme';

const FEATURES = [
  { icon: '💬', label: 'Perguntas em linguagem natural' },
  { icon: '🔍', label: 'SQL gerado automaticamente' },
  { icon: '📊', label: 'Gráficos automáticos com Vega-Lite' },
  { icon: '💾', label: 'Histórico persistente entre sessões' },
  { icon: '🛡️', label: 'Proteção de esquema e dados sensíveis' },
];

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

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
        gap: 28,
        padding: '0 60px',
      }}
    >
      <SunriseIcon size={64} sunColor="#ffd43b" rayColor="#fff176" skyColor="rgba(255,255,255,0.9)" />

      <div
        style={{
          fontSize: 40,
          fontWeight: 800,
          color: '#fff',
          opacity: titleOpacity,
          letterSpacing: -0.5,
        }}
      >
        Aurora
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 480 }}>
        {FEATURES.map((f, i) => {
          const featureOpacity = interpolate(frame, [15 + i * 12, 35 + i * 12], [0, 1], {
            extrapolateRight: 'clamp',
          });
          const featureX = interpolate(frame, [15 + i * 12, 35 + i * 12], [-20, 0], {
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={f.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                opacity: featureOpacity,
                transform: `translateX(${featureX}px)`,
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 10,
                padding: '10px 18px',
              }}
            >
              <span style={{ fontSize: 22 }}>{f.icon}</span>
              <span style={{ fontSize: 15, color: '#fff', fontWeight: 500 }}>{f.label}</span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          opacity: interpolate(frame, [80, 100], [0, 1], { extrapolateRight: 'clamp' }),
          fontSize: 13,
          color: 'rgba(255,255,255,0.6)',
          marginTop: 8,
        }}
      >
        Dados: OMS — Indicador MORT_200 · 194 países · 2000–2017 · Stack: Node.js + LangGraph + Vega-Lite
      </div>
    </div>
  );
};
