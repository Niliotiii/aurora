import React from 'react';
import { interpolate, useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { Shell } from '../components/Shell';
import { Sidebar } from '../components/Sidebar';
import { ChatBubble } from '../components/ChatBubble';
import { InputBar } from '../components/InputBar';
import { TypingLoader } from '../components/Loader';
import { LineChart } from '../components/LineChart';

const QUESTION = 'Qual a evolução da mortalidade neonatal do Brasil entre 2000 e 2017?';
const ANSWER =
  'Taxa de mortalidade neonatal do Brasil (por 1.000 nascidos vivos):\n\n• 2000: 18,3  •  2003: 15,8  •  2006: 13,5\n• 2009: 11,8  •  2012: 10,3  •  2015: 9,4  •  2017: 8,5\n\nQueda de 54% no período (2000–2017), segundo estimativas da OMS.';

// Timeline (frames at 30fps):
// 0–30   : shell aparece
// 30–75  : texto sendo digitado
// 75–90  : botão Enviar pressionado → loading
// 90–130 : loading
// 130–160: resposta em texto aparece
// 160–230: gráfico é desenhado
const FPS = 30;

export const QueryScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Shell fade in
  const shellOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  // Typing: reveal characters 1 per 1.5 frames starting at frame 30
  const typingStart = 30;
  const typingDuration = 60;
  const charCount = Math.floor(
    interpolate(frame, [typingStart, typingStart + typingDuration], [0, QUESTION.length], {
      extrapolateRight: 'clamp',
    }),
  );
  const typedText = QUESTION.slice(0, charCount);
  const isTyping = frame >= typingStart && frame < typingStart + typingDuration;
  const isSending = frame >= typingStart + typingDuration && frame < 130;
  const showLoader = frame >= 92 && frame < 130;

  // User bubble
  const userBubbleOpacity = interpolate(frame, [88, 100], [0, 1], { extrapolateRight: 'clamp' });
  const userBubbleY = interpolate(frame, [88, 100], [10, 0], { extrapolateRight: 'clamp' });

  // Answer text
  const answerOpacity = interpolate(frame, [130, 148], [0, 1], { extrapolateRight: 'clamp' });
  const answerY = interpolate(frame, [130, 148], [12, 0], { extrapolateRight: 'clamp' });

  // Chart draw progress
  const chartProgress = interpolate(frame, [165, 225], [0, 1], { extrapolateRight: 'clamp' });
  const chartOpacity = interpolate(frame, [160, 172], [0, 1], { extrapolateRight: 'clamp' });

  const inputValue = frame < 88 ? typedText : '';

  return (
    <div style={{ width: '100%', height: '100%', opacity: shellOpacity }}>
      <Shell
        sidebarContent={
          <Sidebar
            conversations={[{ id: '1', title: 'Brasil — mortalidade', active: true }]}
          />
        }
      >
        {/* Messages area */}
        <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {frame >= 88 && (
            <ChatBubble
              role="user"
              text={QUESTION}
              opacity={userBubbleOpacity}
              translateY={userBubbleY}
            />
          )}

          {showLoader && <TypingLoader opacity={interpolate(frame, [92, 100], [0, 1], { extrapolateRight: 'clamp' })} />}

          {frame >= 130 && (
            <div style={{ opacity: answerOpacity, transform: `translateY(${answerY}px)` }}>
              <ChatBubble role="assistant" text={ANSWER} />

              {frame >= 160 && (
                <div style={{ marginTop: 12, paddingLeft: 2 }}>
                  <LineChart progress={chartProgress} opacity={chartOpacity} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input bar */}
        <InputBar
          value={inputValue}
          showCursor={isTyping}
          sending={isSending}
        />
      </Shell>
    </div>
  );
};
