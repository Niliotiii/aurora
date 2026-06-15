import React from 'react';
import { colors } from '../theme';

export const TypingLoader: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      opacity,
      padding: '6px 0',
    }}
  >
    <div style={{ display: 'flex', gap: 5 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: colors.teal,
            opacity: 0.6 + 0.4 * Math.sin(i * 1.2),
          }}
        />
      ))}
    </div>
    <span style={{ fontSize: 12, color: colors.textMuted }}>Consultando os dados da OMS…</span>
  </div>
);
