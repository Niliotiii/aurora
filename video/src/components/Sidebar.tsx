import React from 'react';
import { colors } from '../theme';

export const Sidebar: React.FC<{
  conversations: { id: string; title: string; active?: boolean }[];
  showNewButton?: boolean;
  highlightNew?: boolean;
}> = ({ conversations, showNewButton = true, highlightNew = false }) => (
  <>
    {showNewButton && (
      <div
        style={{
          padding: '8px 12px',
          background: highlightNew ? colors.primary : colors.surface,
          color: highlightNew ? '#fff' : colors.text,
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          border: `1px solid ${highlightNew ? colors.primary : colors.border}`,
          textAlign: 'center',
          transition: 'all 0.2s',
        }}
      >
        + Nova conversa
      </div>
    )}
    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {conversations.map((c) => (
        <div
          key={c.id}
          style={{
            padding: '7px 10px',
            borderRadius: 5,
            fontSize: 13,
            background: c.active ? colors.primaryLight : 'transparent',
            color: c.active ? colors.primary : colors.text,
            fontWeight: c.active ? 600 : 400,
            borderLeft: c.active ? `3px solid ${colors.primary}` : '3px solid transparent',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          💬 {c.title}
        </div>
      ))}
    </div>
  </>
);
