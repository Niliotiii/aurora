import React from 'react';
import { colors, font } from '../theme';
import { SunriseIcon } from './SunriseIcon';

export const Shell: React.FC<{
  children: React.ReactNode;
  sidebarContent?: React.ReactNode;
}> = ({ children, sidebarContent }) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      background: colors.bg,
      fontFamily: font.sans,
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    {/* Header */}
    <div
      style={{
        height: 60,
        background: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 20,
        gap: 12,
        flexShrink: 0,
      }}
    >
      <SunriseIcon size={28} skyColor={colors.primary} />
      <span style={{ fontSize: 20, fontWeight: 700, color: colors.text }}>Aurora</span>
      <span style={{ fontSize: 13, color: colors.textMuted, marginLeft: 4 }}>
        Mortalidade Neonatal da OMS
      </span>
    </div>

    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Sidebar */}
      <div
        style={{
          width: 240,
          background: colors.sidebar,
          borderRight: `1px solid ${colors.border}`,
          display: 'flex',
          flexDirection: 'column',
          padding: 12,
          gap: 8,
          flexShrink: 0,
        }}
      >
        {sidebarContent}
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  </div>
);
