import React from 'react';
import { colors, font } from '../theme';

export const ChatBubble: React.FC<{
  role: 'user' | 'assistant';
  text: string;
  opacity?: number;
  translateY?: number;
}> = ({ role, text, opacity = 1, translateY = 0 }) => (
  <div
    style={{
      background: role === 'user' ? colors.primaryLight : colors.surface,
      border: `1px solid ${role === 'user' ? '#a5d8ff' : colors.border}`,
      borderRadius: 8,
      padding: '10px 14px',
      opacity,
      transform: `translateY(${translateY}px)`,
    }}
  >
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: role === 'user' ? colors.primary : colors.teal,
        marginBottom: 5,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
    >
      {role === 'user' ? 'Você' : 'Aurora'}
    </div>
    <div
      style={{
        fontSize: 13,
        color: colors.text,
        lineHeight: 1.55,
        whiteSpace: 'pre-wrap',
        fontFamily: font.sans,
      }}
    >
      {text}
    </div>
  </div>
);
