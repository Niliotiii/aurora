import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { Shell } from '../components/Shell';
import { Sidebar } from '../components/Sidebar';
import { ChatBubble } from '../components/ChatBubble';
import { LineChart } from '../components/LineChart';

const QUESTION = 'Qual a evolução da mortalidade neonatal do Brasil entre 2000 e 2017?';
const ANSWER =
  'Taxa de mortalidade neonatal do Brasil (por 1.000 nascidos vivos):\n\n• 2000: 18,3  •  2006: 13,5  •  2012: 10,3  •  2017: 8,5\n\nQueda de 54% no período (2000–2017).';

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
            { id: '1', title: 'Brasil — evolução', active: conv1Active },
            { id: '2', title: 'Top países em 2015', active: conv2Active },
          ]}
        />
      }
    >
      <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, opacity: contentOpacity }}>
        {showConv2 ? (
          <>
            <ChatBubble role="user" text="Quais países tiveram maior mortalidade neonatal em 2015?" />
            <ChatBubble
              role="assistant"
              text={'Em 2015, os 5 países com maior taxa de mortalidade neonatal (por 1.000 nascidos vivos):\n\n• Paquistão: 46,3\n• República Centro-Africana: 43,1\n• Afeganistão: 41,5\n• Somália: 39,9\n• Sudão do Sul: 39,7'}
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
