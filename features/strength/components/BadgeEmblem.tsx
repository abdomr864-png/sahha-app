import { useMemo } from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import type { BadgeDef } from '../config/badges';
import { LEVEL_COLOR, levelIndex, type RatedLevel } from '../config/levels';

/**
 * Generated award-medallion artwork for a badge — a layered metal seal in the
 * style of athletic championship medals: a studded metal rim whose metal tier
 * rises with the level (bronze → silver → gold → platinum), an accent inner
 * field with a guilloché ring + gloss, a drop-shadowed glyph (barbell /
 * kettlebell / plate / lifter / star), tier star-pips, sunburst + laurel + crown
 * ornamentation for the top tiers, and a ribbon banner at large sizes. Pure SVG,
 * with a dimmed steel "locked" variant.
 */

type Glyph = 'barbell' | 'kettlebell' | 'plate' | 'star' | 'overhead';
type Metal = 'bronze' | 'silver' | 'gold' | 'platinum';

interface EmblemSpec {
  glyph: Glyph;
  metal: Metal;
  /** [light, deep] inner-field accent gradient. */
  accent: readonly [string, string];
  ring: string;
  /** Star pips drawn in the field (level tier 1–4). 0 = none. */
  pips: number;
  sunburst: boolean;
  laurel: boolean;
  /** Centre label (plate count, "2×", "BW") and ribbon text at large sizes. */
  label?: string;
}

/** 3-stop metal gradients, lit from the top-left. */
const METALS: Record<Metal | 'steel', readonly [string, string, string]> = {
  bronze: ['#F4CDA0', '#C67E44', '#854B24'],
  silver: ['#F6FAFE', '#BAC5D1', '#7C8896'],
  gold: ['#FFEFB2', '#F0B62E', '#A2700C'],
  platinum: ['#F2FCFF', '#CDE7F0', '#8DB6C5'],
  steel: ['#70707C', '#494953', '#2B2B34'],
};

const LEVEL_METAL: Record<RatedLevel, Metal> = {
  novice: 'bronze',
  intermediate: 'silver',
  advanced: 'gold',
  elite: 'platinum',
};

const LEVEL_GRADIENT: Record<RatedLevel, readonly [string, string]> = {
  novice: ['#6FF3C6', '#159C6B'],
  intermediate: ['#86C4FF', '#2670D0'],
  advanced: ['#CBA0FF', '#6D28D9'],
  elite: ['#FFC971', '#F0760F'],
};

const GOLD_ACCENT: readonly [string, string] = ['#FFD86B', '#E0860F'];
const FLAME_ACCENT: readonly [string, string] = ['#FF9A6B', '#E22F1E'];

const LIFT_GLYPH: Record<string, Glyph> = {
  squat: 'overhead',
  bench: 'barbell',
  deadlift: 'barbell',
  overhead_press: 'kettlebell',
  barbell_row: 'barbell',
};

/** Derive the medallion design from a badge definition. */
export function emblemSpec(badge: BadgeDef): EmblemSpec {
  if (badge.kind === 'level') {
    const tier = levelIndex(badge.level); // 1..4
    return {
      glyph: LIFT_GLYPH[badge.liftId] ?? 'barbell',
      metal: LEVEL_METAL[badge.level],
      accent: LEVEL_GRADIENT[badge.level],
      ring: LEVEL_COLOR[badge.level],
      pips: tier,
      sunburst: badge.level === 'advanced' || badge.level === 'elite',
      laurel: badge.level === 'elite',
    };
  }

  const plate =
    badge.id === 'plate_1'
      ? 1
      : badge.id === 'plate_2'
        ? 2
        : badge.id === 'plate_3'
          ? 3
          : badge.id === 'plate_4'
            ? 4
            : 0;
  if (plate > 0) {
    return {
      glyph: 'plate',
      metal: plate >= 3 ? 'gold' : 'silver',
      accent: FLAME_ACCENT,
      ring: '#FF6A3C',
      pips: 0,
      sunburst: plate >= 3,
      laurel: plate === 4,
      label: String(plate),
    };
  }

  switch (badge.id) {
    case 'first_pr':
      return {
        glyph: 'star',
        metal: 'gold',
        accent: GOLD_ACCENT,
        ring: '#FFB347',
        pips: 0,
        sunburst: true,
        laurel: false,
      };
    case 'bodyweight_bench':
      return {
        glyph: 'barbell',
        metal: 'gold',
        accent: FLAME_ACCENT,
        ring: '#FF6A3C',
        pips: 0,
        sunburst: true,
        laurel: false,
        label: 'BW',
      };
    case 'squat_1_5x':
      return {
        glyph: 'overhead',
        metal: 'gold',
        accent: GOLD_ACCENT,
        ring: '#FFB347',
        pips: 0,
        sunburst: true,
        laurel: false,
        label: '1.5×',
      };
    case 'deadlift_2x':
      return {
        glyph: 'barbell',
        metal: 'gold',
        accent: FLAME_ACCENT,
        ring: '#FF6A3C',
        pips: 0,
        sunburst: true,
        laurel: true,
        label: '2×',
      };
    default:
      return {
        glyph: 'barbell',
        metal: 'silver',
        accent: GOLD_ACCENT,
        ring: '#FFB347',
        pips: 0,
        sunburst: false,
        laurel: false,
      };
  }
}

const STEEL_ACCENT: readonly [string, string] = ['#41414C', '#23232C'];

export function BadgeEmblem({
  badge,
  size = 64,
  locked = false,
}: {
  badge: BadgeDef;
  size?: number;
  locked?: boolean;
}) {
  const spec = useMemo(() => emblemSpec(badge), [badge]);
  const metal = locked ? METALS.steel : METALS[spec.metal];
  const accent = locked ? STEEL_ACCENT : spec.accent;
  const ring = locked ? '#3C3C48' : spec.ring;
  const glyphFill = locked ? '#7A7A88' : '#FFFFFF';
  const showOrnament = !locked;
  const uid = `${badge.id}${locked ? '_l' : ''}`;
  const ribbon = size >= 104 && !!spec.label;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={`metal_${uid}`} x1="0.12" y1="0.05" x2="0.9" y2="0.96">
          <Stop offset="0" stopColor={metal[0]} />
          <Stop offset="0.5" stopColor={metal[1]} />
          <Stop offset="1" stopColor={metal[2]} />
        </LinearGradient>
        <RadialGradient id={`field_${uid}`} cx="50%" cy="36%" r="72%">
          <Stop offset="0" stopColor={accent[0]} stopOpacity={locked ? 0.5 : 1} />
          <Stop offset="0.6" stopColor={accent[1]} stopOpacity={1} />
          <Stop offset="1" stopColor="#0C0C12" stopOpacity={1} />
        </RadialGradient>
      </Defs>

      {/* Ornamentation behind the medal */}
      {showOrnament && spec.sunburst ? <Sunburst color={metal[1]} /> : null}
      {showOrnament ? <Circle cx={50} cy={50} r={45} fill={ring} opacity={0.12} /> : null}

      {/* Metal rim */}
      <Circle cx={50} cy={50} r={42} fill={`url(#metal_${uid})`} />
      <Circle
        cx={50}
        cy={50}
        r={42}
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity={locked ? 0.06 : 0.3}
        strokeWidth={1}
      />
      <Circle
        cx={50}
        cy={50}
        r={42}
        fill="none"
        stroke="#000000"
        strokeOpacity={0.28}
        strokeWidth={0.8}
      />
      <Studs color={metal[0]} edge={metal[2]} />

      {/* Inner field */}
      <Circle cx={50} cy={50} r={32.5} fill={`url(#field_${uid})`} />
      <Circle cx={50} cy={50} r={32.5} fill="none" stroke={metal[2]} strokeWidth={2} />
      <Circle
        cx={50}
        cy={50}
        r={32.5}
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity={locked ? 0.05 : 0.16}
        strokeWidth={1}
      />
      {/* Guilloché ring */}
      <Circle
        cx={50}
        cy={50}
        r={27.5}
        fill="none"
        stroke={accent[0]}
        strokeOpacity={locked ? 0.12 : 0.32}
        strokeWidth={1}
        strokeDasharray="1.5 2.5"
      />

      {/* Gloss highlight over the top of the field */}
      {!locked ? <Ellipse cx={50} cy={33} rx={22} ry={11} fill="#FFFFFF" opacity={0.14} /> : null}

      {/* Laurel wreath framing the rim (elite / top milestones) */}
      {showOrnament && spec.laurel ? <Laurel /> : null}

      {/* Central glyph (with a soft drop shadow) */}
      <G transform="translate(0,-2)">
        <G transform="translate(0,2)" opacity={0.35}>
          <Glyphs
            glyph={spec.glyph}
            fill="#000000"
            accent="#000000"
            label={spec.label}
            ribbon={ribbon}
          />
        </G>
        <Glyphs
          glyph={spec.glyph}
          fill={glyphFill}
          accent={ring}
          label={spec.label}
          ribbon={ribbon}
        />
      </G>

      {/* Tier star-pips */}
      {spec.pips > 0 ? (
        <StarPips
          count={spec.pips}
          color={locked ? '#5A5A66' : metal[0]}
          edge={locked ? '#23232C' : metal[2]}
        />
      ) : null}

      {/* Ribbon banner (large sizes only) */}
      {ribbon && spec.label ? <Ribbon color={ring} edge={metal[2]} label={spec.label} /> : null}
    </Svg>
  );
}

/* ───────────────────────── frame parts ───────────────────────── */

function Studs({ color, edge }: { color: string; edge: string }) {
  const count = 12;
  const r = 37.2;
  return (
    <G>
      {Array.from({ length: count }, (_, i) => {
        const a = (i * 2 * Math.PI) / count - Math.PI / 2;
        const cx = 50 + r * Math.cos(a);
        const cy = 50 + r * Math.sin(a);
        return (
          <Circle key={i} cx={cx} cy={cy} r={1.5} fill={color} stroke={edge} strokeWidth={0.5} />
        );
      })}
    </G>
  );
}

function StarPips({ count, color, edge }: { count: number; color: string; edge: string }) {
  const gap = 8.5;
  const startX = 50 - ((count - 1) * gap) / 2;
  return (
    <G>
      {Array.from({ length: count }, (_, i) => (
        <Star
          key={i}
          cx={startX + i * gap}
          cy={70}
          r={3.1}
          fill={color}
          stroke={edge}
          strokeWidth={0.5}
        />
      ))}
    </G>
  );
}

function Ribbon({ color, edge, label }: { color: string; edge: string; label: string }) {
  return (
    <G>
      {/* tails */}
      <Path d="M30 80 L24 95 L34 90 L38 84 Z" fill={edge} opacity={0.9} />
      <Path d="M70 80 L76 95 L66 90 L62 84 Z" fill={edge} opacity={0.9} />
      {/* banner */}
      <Path
        d="M28 78 L72 78 L76 86 L72 94 L28 94 L24 86 Z"
        fill={color}
        stroke={edge}
        strokeWidth={1}
        strokeLinejoin="round"
      />
      <SvgText x={50} y={89.5} fill="#0E0E15" fontSize={9} fontWeight="900" textAnchor="middle">
        {label}
      </SvgText>
    </G>
  );
}

/* ───────────────────────── glyphs ───────────────────────── */

function Glyphs({
  glyph,
  fill,
  accent,
  label,
  ribbon,
}: {
  glyph: Glyph;
  fill: string;
  accent: string;
  label?: string;
  ribbon: boolean;
}) {
  const body =
    glyph === 'barbell' ? (
      <Barbell fill={fill} />
    ) : glyph === 'kettlebell' ? (
      <Kettlebell fill={fill} />
    ) : glyph === 'plate' ? (
      <Plate fill={fill} accent={accent} />
    ) : glyph === 'overhead' ? (
      <Overhead fill={fill} />
    ) : (
      <Star cx={50} cy={47} r={16} fill={fill} />
    );

  // Centre label only when there is no ribbon to carry it (small sizes), and
  // never for plates (the plate prints its own number).
  const showCentreLabel = !!label && !ribbon && glyph !== 'plate';

  return (
    <>
      {body}
      {glyph === 'plate' && label ? (
        <SvgText x={50} y={52.5} fill="#13131A" fontSize={15} fontWeight="900" textAnchor="middle">
          {label}
        </SvgText>
      ) : null}
      {showCentreLabel ? (
        <SvgText x={50} y={66} fill={fill} fontSize={12} fontWeight="900" textAnchor="middle">
          {label}
        </SvgText>
      ) : null}
    </>
  );
}

function Barbell({ fill }: { fill: string }) {
  return (
    <G>
      <Rect x={25} y={45.5} width={50} height={5} rx={2.5} fill={fill} />
      <Rect x={30} y={42} width={4} height={12} rx={2} fill={fill} />
      <Rect x={66} y={42} width={4} height={12} rx={2} fill={fill} />
      <Rect x={23} y={36} width={5.5} height={24} rx={2.5} fill={fill} />
      <Rect x={16.5} y={39.5} width={4.5} height={17} rx={2.25} fill={fill} />
      <Rect x={71.5} y={36} width={5.5} height={24} rx={2.5} fill={fill} />
      <Rect x={79} y={39.5} width={4.5} height={17} rx={2.25} fill={fill} />
    </G>
  );
}

function Kettlebell({ fill }: { fill: string }) {
  return (
    <G>
      <Path
        d="M40 41 C40 31 60 31 60 41"
        fill="none"
        stroke={fill}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <Path
        d="M38 44 Q38 40 43 40 L57 40 Q62 40 62 44 L65 57 Q65 71 50 71 Q35 71 35 57 Z"
        fill={fill}
      />
    </G>
  );
}

function Overhead({ fill }: { fill: string }) {
  return (
    <G>
      <Rect x={29} y={29} width={42} height={4} rx={2} fill={fill} />
      <Rect x={27} y={25} width={4.5} height={12} rx={2} fill={fill} />
      <Rect x={68.5} y={25} width={4.5} height={12} rx={2} fill={fill} />
      <Circle cx={50} cy={45} r={5} fill={fill} />
      <Path d="M50 50 L41 35 M50 50 L59 35" stroke={fill} strokeWidth={4.2} strokeLinecap="round" />
      <Path
        d="M50 50 L50 63 M50 63 L43 74 M50 63 L57 74"
        stroke={fill}
        strokeWidth={4.6}
        strokeLinecap="round"
      />
    </G>
  );
}

function Plate({ fill, accent }: { fill: string; accent: string }) {
  return (
    <G>
      <Circle cx={50} cy={50} r={18} fill="none" stroke={fill} strokeWidth={9} />
      <Circle
        cx={50}
        cy={50}
        r={18}
        fill="none"
        stroke={accent}
        strokeOpacity={0.3}
        strokeWidth={9}
      />
      <Circle cx={50} cy={50} r={9} fill={fill} />
    </G>
  );
}

/* ─────────────────────── ornamentation ─────────────────────── */

function Star({
  cx,
  cy,
  r,
  fill,
  stroke,
  strokeWidth,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.44;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${cx + radius * Math.cos(a)},${cy + radius * Math.sin(a)}`);
  }
  return <Polygon points={pts.join(' ')} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
}

function Sunburst({ color }: { color: string }) {
  const count = 24;
  return (
    <G opacity={0.9}>
      {Array.from({ length: count }, (_, i) => (
        <G key={i} rotation={(i * 360) / count} origin="50, 50">
          <Polygon points="48.4,1 51.6,1 50,11" fill={color} />
        </G>
      ))}
    </G>
  );
}

// Gold "champion" wreath framing the rim — drawn on top of the metal so it
// reads at any tier. Left branch + mirrored right branch.
const LAUREL_FILL = '#F3C24C';
const LAUREL_EDGE = '#8A5712';

function Laurel() {
  return (
    <>
      <LaurelBranch />
      <G transform="translate(100,0) scale(-1,1)">
        <LaurelBranch />
      </G>
    </>
  );
}

function LaurelBranch() {
  const leaves = [
    { x: 9, y: 72, rot: -54 },
    { x: 5.2, y: 61, rot: -36 },
    { x: 3.8, y: 50, rot: -16 },
    { x: 5, y: 39, rot: 6 },
    { x: 9, y: 29, rot: 26 },
    { x: 15.5, y: 21, rot: 46 },
  ];
  return (
    <G>
      <Path
        d="M11 78 C2 66 1 47 16 21"
        fill="none"
        stroke={LAUREL_EDGE}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      {leaves.map((l) => (
        <G key={`${l.x}-${l.y}`} rotation={l.rot} origin={`${l.x}, ${l.y}`}>
          <Ellipse
            cx={l.x}
            cy={l.y}
            rx={5.3}
            ry={2.5}
            fill={LAUREL_FILL}
            stroke={LAUREL_EDGE}
            strokeWidth={0.4}
          />
        </G>
      ))}
    </G>
  );
}
