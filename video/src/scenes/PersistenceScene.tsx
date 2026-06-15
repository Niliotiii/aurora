import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { Shell } from '../components/Shell';
import { Sidebar } from '../components/Sidebar';
import { ChatBubble } from '../components/ChatBubble';
import { LineChart } from '../components/LineChart';

const QUESTION = 'Qual a taxa de mortalidade neonatal do Brasil entre 1990 e 2000 por ano?';
const ANSWER =
  'Taxa de mortalidade neonatal do Brasil (por 1.000 nascidos vivos):\n\n• 1990: 36,2  •  1992: 33,5  •  1994: 31,1\n• 1996: 28,7  •  1998: 25,9  •  2000: 22,8\n\nQueda de 37% no período.';

// Timeline:
// 0–20   : mostrando conversa 1 completa com gráfico
// 20–50  : clique na conversa 2 (diferente)
// 50–80  : conversa 2 aparece (texto diferente, sem gráfico)
// 80–110 : volta para conversa 1
// 110–150: gráfico ainda está lá — persistência confirmada

export const PersistenceScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Which conversation is active
  const showConv2 = frame >= 35 && frame < 95;
  const backToConv1 = frame >= 95;

  const conv1Active = !showConv2;
  const conv2Active = showConv2;

  // Flash effect when switching
  const switchFlash1 = interpolate(frame, [32, 40], [1, 0], { extrapolateRight: 'clamp' });
  const switchFlash2 = interpolate(frame, [92, 100], [1, 0], { extrapolateRight: 'clamp' });
  const contentOpacity = showConv2
    ? interpolate(frame, [35, 48], [0, 1], { extrapolateRight: 'clamp' })
    : backToConv1
      ? interpolate(frame, [95, 108], [0, 1], { extrapolateRight: 'clamp' })
      : 1;

  // Label for persistence
  const labelOpacity = interpolate(frame, [115, 130], [0, 1], { extrapolateRight: 'clamp' });
  const labelY = interpolate(frame, [115, 130], [10, 0], { extrapolateRight: 'clamp' });

  return (
    <Shell
      sidebarContent={
        <Sidebar
          conversations={[
            { id: '1', title: 'Brasil — mortalidade', active: conv1Active },
            { id: '2', title: 'Comparação países 2000', active: conv2Active },
          ]}
        />
      }
    >
      <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, opacity: contentOpacity }}>
        {showConv2 ? (
          <>
            <ChatBubble role="user" text="Quais países tiveram maior mortalidade neonatal em 1995?" />
            <ChatBubble
              role="assistant"
              text={'Em 1995, os países com maior taxa de mortalidade neonatal (por 1.000 nascidos vivos) eram:\n\n• Guiné-Bissau: 49,3\n• Serra Leoa: 47,8\n• Somália: 46,1\n• Mali: 45,6\n• República Centro-Africana: 44,9'}
            />
          </>
        ) : (
          <>
            <ChatBubble role="user" text={QUESTION} />
            <ChatBubble role="assistant" text={ANSWER} />
            <div style={{ paddingLeft: 2, position: 'relative' }}>
              <LineChart progress={1} opacity={1} />

              {/* Persistence badge */}
              {backToConv1 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: '#2f9e44',
                    color: '#fff',
                    borderRadius: 6,
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    opacity: labelOpacity,
                    transform: `translateY(${labelY}px)`,
                    boxShadow: '0 2px 8px rgba(47,158,68,0.4)',
                  }}
                >
                  ✓ Gráfico preservado no histórico
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Shell>
  );
};
