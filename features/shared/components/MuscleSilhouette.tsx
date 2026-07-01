// 2D anatomical body diagram with primary / secondary muscle highlights.
//
// Renders front + back views using `react-native-body-highlighter` (pure SVG,
// no native deps beyond react-native-svg). Inputs are the tokens used across
// the codebase (chest, back, shoulders, arms, legs, glutes, core, fullBody)
// and they are expanded to the library's anatomical slugs internally.

import { View } from 'react-native';
import Body, { type ExtendedBodyPart, type Slug } from 'react-native-body-highlighter';

type Muscle = string;

interface Props {
  primary: Muscle[];
  secondary?: Muscle[];
  size?: number;
  /** When true, shows a front + back diagram side-by-side. */
  showBack?: boolean;
}

// Maps app-level muscle tokens to the anatomical slugs the library exposes.
const TOKEN_TO_SLUGS: Record<string, Slug[]> = {
  chest: ['chest'],
  back: ['upper-back', 'lower-back', 'trapezius'],
  shoulders: ['deltoids'],
  arms: ['biceps', 'triceps', 'forearm'],
  legs: ['quadriceps', 'hamstring', 'calves', 'adductors'],
  glutes: ['gluteal'],
  core: ['abs', 'obliques'],
  fullBody: [
    'chest',
    'upper-back',
    'lower-back',
    'trapezius',
    'deltoids',
    'biceps',
    'triceps',
    'forearm',
    'quadriceps',
    'hamstring',
    'calves',
    'gluteal',
    'abs',
    'obliques',
  ],
};

function expand(tokens: Muscle[]): Set<Slug> {
  const out = new Set<Slug>();
  for (const t of tokens) {
    const slugs = TOKEN_TO_SLUGS[t];
    if (slugs) slugs.forEach((s) => out.add(s));
  }
  return out;
}

function buildData(primary: Muscle[], secondary: Muscle[]): ExtendedBodyPart[] {
  const primarySlugs = expand(primary);
  const secondarySlugs = expand(secondary);
  const data: ExtendedBodyPart[] = [];
  for (const slug of primarySlugs) {
    data.push({ slug, intensity: 2 });
  }
  for (const slug of secondarySlugs) {
    if (primarySlugs.has(slug)) continue;
    data.push({ slug, intensity: 1 });
  }
  return data;
}

export function MuscleSilhouette({ primary, secondary = [], size = 160, showBack = true }: Props) {
  const data = buildData(primary, secondary);
  // The library renders at a fixed intrinsic size; `scale` adjusts it.
  // ~180 native units → divide our pixel target by that to get scale.
  const scale = size / 180;
  return (
    <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
      <Body
        data={data}
        side="front"
        scale={scale}
        colors={['#FF8A2B', '#FF4D2E']}
        border="#21212B"
      />
      {showBack ? (
        <Body
          data={data}
          side="back"
          scale={scale}
          colors={['#FF8A2B', '#FF4D2E']}
          border="#21212B"
        />
      ) : null}
    </View>
  );
}
