import React from 'react';
import { Composition } from 'remotion';
import { AuroraDemo, TOTAL_DURATION } from './AuroraDemo';

export const Root: React.FC = () => (
  <Composition
    id="AuroraDemo"
    component={AuroraDemo}
    durationInFrames={TOTAL_DURATION}
    fps={30}
    width={1280}
    height={720}
  />
);
