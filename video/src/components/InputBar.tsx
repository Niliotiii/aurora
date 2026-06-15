import React from 'react';
import { colors } from '../theme';

export const InputBar: React.FC<{
  value: string;
  showCursor?: boolean;
  sending?: boolean;
}> = ({ value, showCursor = false, sending = false }) => (
  <div
    style={{
      padding: '10px 16px',
      borderTop: `1px solid ${colors.border}`,
      background: colors.surface,
      display: 'flex',
      gap: 8,
      alignItems: 'center',
    }}
  >
    <div
      style={{
        flex: 1,
        padding: '8px 12px',
        border: `1px solid ${colors.border}`,
        borderRadius: 6,
        fontSize: 13,
        color: value ? colors.text : colors.textDim,
        background: colors.bg,
        minHeight: 36,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {value || 'Faça uma pergunta sobre os dados de mortalidade neonatal da OMS…'}
      {showCursor && (
        <span
          style={{
            display: 'inline-block',
            width: 2,
            height: 14,
            background: colors.primary,
            marginLeft: 1,
            verticalAlign: 'middle',
          }}
        />
      )}
    </div>
    <div
      style={{
        padding: '8px 16px',
        background: sending ? colors.textMuted : colors.primary,
        color: '#fff',
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 600,
        minWidth: 64,
        textAlign: 'center',
      }}
    >
      {sending ? '...' : 'Enviar'}
    </div>
  </div>
);
