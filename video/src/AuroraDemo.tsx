import React from 'react';
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion';
import { Intro } from './scenes/Intro';
import { QueryScene } from './scenes/QueryScene';
import { CausesScene } from './scenes/CausesScene';
import { PersistenceScene } from './scenes/PersistenceScene';
import { Outro } from './scenes/Outro';
import { colors, font } from './theme';

// Scene durations in frames (30fps)
export const INTRO_DURATION = 90;        // 3s
export const QUERY_DURATION = 240;       // 8s
export const CAUSES_DURATION = 225;      // 7.5s
export const PERSISTENCE_DURATION = 165; // 5.5s
export const OUTRO_DURATION = 120;       // 4s
export const TOTAL_DURATION =
  INTRO_DURATION + QUERY_DURATION + CAUSES_DURATION + PERSISTENCE_DURATION + OUTRO_DURATION;

const FADE = 10;

// Wraps a scene so it fades in and out at the boundaries of its Sequence window.
const FadeScene: React.FC<{
  children: React.ReactNode;
  durationInFrames: number;
}> = ({ children, durationInFrames }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, FADE, durationInFrames - FADE, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

const Label: React.FC<{ text: string; durationInFrames: number }> = ({
  text,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, 12, durationInFrames - 15, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.55)',
        color: '#fff',
        fontFamily: font.sans,
        fontSize: 12,
        fontWeight: 600,
        padding: '5px 16px',
        borderRadius: 20,
        opacity,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
};

export const AuroraDemo: React.FC = () => (
  <AbsoluteFill style={{ background: colors.bg }}>
    <Sequence from={0} durationInFrames={INTRO_DURATION}>
      <FadeScene durationInFrames={INTRO_DURATION}>
        <Intro />
      </FadeScene>
    </Sequence>

    <Sequence from={INTRO_DURATION} durationInFrames={QUERY_DURATION}>
      <FadeScene durationInFrames={QUERY_DURATION}>
        <QueryScene />
      </FadeScene>
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <Label
          text="📝 Pergunta em linguagem natural → SQL automático → Gráfico"
          durationInFrames={QUERY_DURATION}
        />
      </AbsoluteFill>
    </Sequence>

    <Sequence from={INTRO_DURATION + QUERY_DURATION} durationInFrames={CAUSES_DURATION}>
      <FadeScene durationInFrames={CAUSES_DURATION}>
        <CausesScene />
      </FadeScene>
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <Label
          text="🔬 14 causas de morte — análise por causa com gráfico automático"
          durationInFrames={CAUSES_DURATION}
        />
      </AbsoluteFill>
    </Sequence>

    <Sequence from={INTRO_DURATION + QUERY_DURATION + CAUSES_DURATION} durationInFrames={PERSISTENCE_DURATION}>
      <FadeScene durationInFrames={PERSISTENCE_DURATION}>
        <PersistenceScene />
      </FadeScene>
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <Label
          text="💾 Gráfico preservado ao trocar de conversa"
          durationInFrames={PERSISTENCE_DURATION}
        />
      </AbsoluteFill>
    </Sequence>

    <Sequence
      from={INTRO_DURATION + QUERY_DURATION + CAUSES_DURATION + PERSISTENCE_DURATION}
      durationInFrames={OUTRO_DURATION}
    >
      <FadeScene durationInFrames={OUTRO_DURATION}>
        <Outro />
      </FadeScene>
    </Sequence>
  </AbsoluteFill>
);
