import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Shell } from '../components/Shell';
import { Sidebar } from '../components/Sidebar';
import { ChatBubble } from '../components/ChatBubble';
import { InputBar } from '../components/InputBar';
import { TypingLoader } from '../components/Loader';
import { BarChart } from '../components/BarChart';

const QUESTION = 'Quais as 5 maiores causas de mortalidade neonatal do Brasil em 2017?';
const ANSWER =
  'As 5 maiores causas de mortalidade neonatal no Brasil em 2017 (por 1.000 nascidos vivos):\n\n1. Prematuridade: 2,49\n2. Anomalias congênitas: 1,76\n3. Outras condições perinatais: 1,56\n4. Asfixia perinatal: 1,27\n5. Sepse neonatal: 1,18';

// Timeline (frames at 30fps):
// 0–20   : shell aparece
// 20–65  : texto sendo digitado
// 65–80  : enviando → loading
// 80–120 : loading
// 120–145: resposta aparece
// 145–210: gráfico de barras se constrói
const FPS = 30;

export const CausesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const shellOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  const typingStart = 20;
  const typingDuration = 55;
  const charCount = Math.floor(
    interpolate(frame, [typingStart, typingStart + typingDuration], [0, QUESTION.length], {
      extrapolateRight: 'clamp',
    }),
  );
  const typedText = QUESTION.slice(0, charCount);
  const isTyping = frame >= typingStart && frame < typingStart + typingDuration;
  const isSending = frame >= typingStart + typingDuration && frame < 120;
  const showLoader = frame >= 78 && frame < 120;

  const userBubbleOpacity = interpolate(frame, [74, 85], [0, 1], { extrapolateRight: 'clamp' });
  const userBubbleY = interpolate(frame, [74, 85], [10, 0], { extrapolateRight: 'clamp' });

  const answerOpacity = interpolate(frame, [120, 138], [0, 1], { extrapolateRight: 'clamp' });
  const answerY = interpolate(frame, [120, 138], [12, 0], { extrapolateRight: 'clamp' });

  const chartProgress = interpolate(frame, [150, 210], [0, 1], { extrapolateRight: 'clamp' });
  const chartOpacity = interpolate(frame, [145, 158], [0, 1], { extrapolateRight: 'clamp' });

  const inputValue = frame < 74 ? typedText : '';

  return (
    <div style={{ width: '100%', height: '100%', opacity: shellOpacity }}>
      <Shell
        sidebarContent={
          <Sidebar
            conversations={[
              { id: '1', title: 'Brasil — evolução', active: false },
              { id: '2', title: 'Causas Brasil 2017', active: true },
            ]}
          />
        }
      >
        <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {frame >= 74 && (
            <ChatBubble
              role="user"
              text={QUESTION}
              opacity={userBubbleOpacity}
              translateY={userBubbleY}
            />
          )}

          {showLoader && (
            <TypingLoader opacity={interpolate(frame, [78, 88], [0, 1], { extrapolateRight: 'clamp' })} />
          )}

          {frame >= 120 && (
            <div style={{ opacity: answerOpacity, transform: `translateY(${answerY}px)` }}>
              <ChatBubble role="assistant" text={ANSWER} />

              {frame >= 145 && (
                <div style={{ marginTop: 12, paddingLeft: 2 }}>
                  <BarChart progress={chartProgress} opacity={chartOpacity} />
                </div>
              )}
            </div>
          )}
        </div>

        <InputBar value={inputValue} showCursor={isTyping} sending={isSending} />
      </Shell>
    </div>
  );
};
