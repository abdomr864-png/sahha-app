/* eslint-disable max-lines -- Landing marketing page: many inline device mockups; splitting fragments the layout. */
import * as React from 'react';
import {
  Home,
  Users,
  Sparkles,
  TrendingUp,
  User,
  Dumbbell,
  Flame,
  Apple,
  Camera,
  Play,
  BarChart3,
  Medal,
  Ruler,
  Scale,
  Heart,
  MessageCircle,
  Bookmark,
  Plus,
  Check,
  ArrowUp,
  Image as ImageIcon,
  MoreHorizontal,
  Bell,
  Crown,
  Target,
  Clock,
  ChevronRight,
  History,
  X,
  type LucideIcon,
} from 'lucide-react';

/**
 * Faithful, pixel-honest recreations of the real Sahha mobile-app screens —
 * same layout, copy, palette and the signature floating tab bar with the raised
 * violet "Coach" orb. Built to render inside PhoneFrame at a fixed logical
 * resolution (320 × 694) so every thumbnail is a true miniature of the device.
 *
 * Palette + structure mirror the app source:
 *   app/(tabs)/index.tsx, coach.tsx, feed.tsx, progress.tsx, profile.tsx
 *   features/shared/components/TabBar.tsx, features/ai-coach, community, scan.
 */

/* ---------------------------------------------------------------- palette */

export const sa = {
  bg: '#0A0A0F',
  bgDeep: '#0E0E15',
  card: '#14141C',
  raised: '#1B1B25',
  elevated: '#23232F',
  pressed: '#2C2C3A',
  ink: '#F4F4F7',
  inkSub: '#B4B4C2',
  inkMuted: '#74748A',
  inkDim: '#52525B',
  accent: '#FF4D2E',
  accentSoft: '#FF8A2B',
  accentBright: '#FF7A1A',
  accentEnd: '#FF2D55',
  accentDeep: '#C9184A',
  border: '#21212B',
  borderStrong: '#34343F',
  success: '#2EE6A6',
  warning: '#F5C451',
  danger: '#FF4D6D',
  cyan: '#22D3EE',
  violet: '#A855F7',
  violetDeep: '#6366F1',
  blue: '#2BD2FF',
};

export const PHONE_W = 320;
export const PHONE_H = 694;

/* ------------------------------------------------------------- primitives */

const StatusBar = () => (
  <div className="flex items-center justify-between px-6 pt-3 pb-1" style={{ color: sa.ink }}>
    <span className="text-[13px] font-semibold font-display">9:41</span>
    <div className="flex items-center gap-1.5">
      <svg width="17" height="11" viewBox="0 0 17 11" fill="none">
        {[3, 6, 9, 12].map((x, i) => (
          <rect
            key={x}
            x={x * 1.1}
            y={8 - i * 2}
            width="2.5"
            height={3 + i * 2}
            rx="0.6"
            fill={sa.ink}
          />
        ))}
      </svg>
      <svg width="22" height="11" viewBox="0 0 24 12" fill="none">
        <rect x="1" y="1" width="20" height="10" rx="2.5" stroke={sa.ink} strokeOpacity="0.5" />
        <rect x="3" y="3" width="14" height="6" rx="1" fill={sa.ink} />
        <rect x="22" y="4" width="1.6" height="4" rx="0.8" fill={sa.ink} fillOpacity="0.5" />
      </svg>
    </div>
  </div>
);

/** Body wrapper: status bar + a hidden-scroll scroll area, room left for the tab bar. */
const Body: React.FC<{ children: React.ReactNode; pb?: number }> = ({ children, pb = 116 }) => (
  <div className="flex h-full flex-col" style={{ background: sa.bg, color: sa.ink }}>
    <StatusBar />
    <div className="hide-scroll flex-1 overflow-y-auto" style={{ paddingBottom: pb }}>
      {children}
    </div>
  </div>
);

const Ring: React.FC<{
  pct: number;
  size: number;
  stroke: number;
  from: string;
  to: string;
  id: string;
  track?: string;
}> = ({ pct, size, stroke, from, to, id, track = sa.border }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <svg width={size} height={size}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      {clamped > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
    </svg>
  );
};

/* ============================================================ TAB BAR */

export type TabKey = 'home' | 'feed' | 'coach' | 'progress' | 'profile';

const TAB_DEFS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'feed', label: 'Feed', icon: Users },
  { key: 'coach', label: 'Coach', icon: Sparkles },
  { key: 'progress', label: 'Progress', icon: TrendingUp },
  { key: 'profile', label: 'Profile', icon: User },
];

export const PhoneTabBar: React.FC<{
  active: TabKey;
  onChange?: (k: TabKey) => void;
}> = ({ active, onChange }) => (
  <div className="absolute inset-x-0 bottom-0 z-20" style={{ padding: '8px 14px 16px' }}>
    <div
      className="flex items-stretch justify-between px-2"
      style={{
        height: 66,
        borderRadius: 30,
        background: sa.raised,
        border: `1px solid ${sa.border}`,
        boxShadow: '0 12px 30px -8px rgba(0,0,0,0.6)',
      }}
    >
      {TAB_DEFS.map((tab) => {
        const focused = active === tab.key;
        if (tab.key === 'coach') {
          return (
            <button
              key={tab.key}
              onClick={() => onChange?.(tab.key)}
              className="flex flex-1 flex-col items-center justify-center"
            >
              <div
                className="grid place-items-center rounded-full"
                style={{
                  width: 52,
                  height: 52,
                  marginTop: -26,
                  background: `linear-gradient(135deg, ${'#B06BFF'}, ${sa.violetDeep})`,
                  boxShadow: '0 6px 16px -2px rgba(99,102,241,0.6)',
                }}
              >
                <Sparkles size={22} color="#fff" strokeWidth={2.2} />
              </div>
              <span
                className={`mt-1 text-[9px] uppercase tracking-wider ${focused ? 'font-extrabold' : 'font-bold'}`}
                style={{ color: focused ? sa.ink : sa.inkMuted }}
              >
                {tab.label}
              </span>
            </button>
          );
        }
        return (
          <button
            key={tab.key}
            onClick={() => onChange?.(tab.key)}
            className="flex flex-1 flex-col items-center justify-center gap-1"
          >
            <tab.icon
              size={21}
              color={focused ? sa.ink : sa.inkMuted}
              strokeWidth={focused ? 2.3 : 1.9}
            />
            <span
              className={`text-[9px] uppercase tracking-wider ${focused ? 'font-extrabold' : 'font-bold'}`}
              style={{ color: focused ? sa.ink : sa.inkMuted }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

/* ============================================================ HOME / TODAY */

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_COMPLETION = [1, 1, 1, 1, 1, 0.55, 0];
const TODAY_IDX = 5;

const DayRing: React.FC<{ value: number; active: boolean; dim: boolean }> = ({
  value,
  active,
  dim,
}) => {
  const size = 38;
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const done = pct >= 1;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={active ? sa.borderStrong : sa.border}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={dim ? `${c / 32},${c / 32}` : undefined}
        />
        {pct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={sa.accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      {done ? (
        <Check size={15} color={sa.accent} strokeWidth={3} />
      ) : dim ? (
        <span
          style={{ width: 4, height: 4, borderRadius: 2, background: sa.accent, opacity: 0.5 }}
        />
      ) : null}
    </div>
  );
};

const HeroCard: React.FC<{
  pct: number;
  from: string;
  to: string;
  id: string;
  center: string;
  centerSub: string;
  kicker: string;
  kickerIcon: LucideIcon;
  headline: string;
  unit?: string;
  sub: string;
}> = ({ pct, from, to, id, center, centerSub, kicker, kickerIcon: KIcon, headline, unit, sub }) => (
  <div
    className="mb-4 rounded-[26px] p-4"
    style={{ background: sa.card, border: `1px solid ${sa.border}` }}
  >
    <div className="flex items-center">
      <div className="relative grid place-items-center" style={{ width: 94, height: 94 }}>
        <Ring pct={pct} size={94} stroke={8} from={from} to={to} id={id} />
        <div className="absolute flex flex-col items-center">
          <span className="font-display" style={{ fontSize: 19, lineHeight: '21px' }}>
            {center}
          </span>
          <span style={{ fontSize: 9, fontWeight: 600, color: sa.inkMuted }}>{centerSub}</span>
        </div>
      </div>
      <div className="ml-4 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <KIcon size={15} color={sa.inkSub} />
          <span
            className="text-[10px] font-extrabold uppercase"
            style={{ letterSpacing: 1.4, color: sa.inkMuted }}
          >
            {kicker}
          </span>
        </div>
        <div className="flex items-baseline">
          <span className="font-display" style={{ fontSize: 30, lineHeight: '32px' }}>
            {headline}
          </span>
          {unit && (
            <span className="ml-1 text-sm font-bold" style={{ color: sa.inkMuted }}>
              {unit}
            </span>
          )}
        </div>
        <p className="mt-1 text-[12.5px]" style={{ color: sa.inkSub }}>
          {sub}
        </p>
      </div>
    </div>
  </div>
);

const MacroCard: React.FC<{
  value: number;
  target: number;
  label: string;
  from: string;
  to: string;
  id: string;
  unit?: string;
}> = ({ value, target, label, from, to, id, unit = 'g' }) => {
  const pct = target > 0 ? Math.max(0, Math.min(1, value / target)) : 0;
  const size = 62;
  return (
    <div
      className="flex flex-1 flex-col items-center rounded-[26px] p-3"
      style={{ background: sa.card, border: `1px solid ${sa.border}` }}
    >
      <div className="relative grid place-items-center" style={{ width: size, height: size }}>
        <Ring pct={pct} size={size} stroke={6} from={from} to={to} id={id} />
        <div className="absolute font-display" style={{ fontSize: 14 }}>
          {Math.round(pct * 100)}
          <span style={{ fontSize: 9, color: sa.inkMuted }}>%</span>
        </div>
      </div>
      <div className="mt-2.5 flex flex-col items-center">
        <span className="font-display text-[13px]">
          {value}
          <span style={{ color: sa.inkMuted, fontWeight: 500 }}>
            /{target}
            {unit}
          </span>
        </span>
        <span className="mt-0.5 text-[11px]" style={{ color: sa.inkMuted }}>
          {label}
        </span>
      </div>
    </div>
  );
};

const BioCard: React.FC<{
  value: string;
  unit: string;
  label: string;
  color: string;
  icon: LucideIcon;
}> = ({ value, unit, label, color, icon: I }) => (
  <div
    className="flex flex-1 flex-col rounded-[26px] p-3.5"
    style={{ background: sa.raised, border: `1px solid ${sa.border}` }}
  >
    <div className="flex items-baseline">
      <span className="text-2xl font-extrabold tracking-tight">{value}</span>
      {unit && (
        <span className="ml-0.5 text-sm font-bold" style={{ color: sa.inkMuted }}>
          {unit}
        </span>
      )}
    </div>
    <span className="mt-0.5 text-[11px]" style={{ color: sa.inkSub }}>
      {label}
    </span>
    <div className="mt-2 flex justify-center">
      <div
        className="grid place-items-center"
        style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          background: sa.border,
          border: `1px solid ${color}40`,
        }}
      >
        <I size={20} color={color} />
      </div>
    </div>
  </div>
);

const CTACard: React.FC<{
  gradient: string;
  glow: string;
  icon: LucideIcon;
  kicker: string;
  title: string;
  sub: string;
}> = ({ gradient, glow, icon: I, kicker, title, sub }) => (
  <button
    className="relative mb-3 block w-full overflow-hidden rounded-2xl text-left"
    style={{ background: gradient, boxShadow: `0 10px 24px -6px ${glow}66`, padding: '18px 20px' }}
  >
    <div
      className="pointer-events-none absolute -right-5 -top-5 h-28 w-28 rounded-full"
      style={{ background: 'rgba(255,255,255,0.16)' }}
    />
    <div className="flex items-center gap-3.5">
      <div
        className="grid place-items-center"
        style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(255,255,255,0.2)' }}
      >
        <I size={24} color="#fff" />
      </div>
      <div className="flex-1">
        <div
          className="text-[10px] font-extrabold uppercase text-white"
          style={{ letterSpacing: 1.4, opacity: 0.85 }}
        >
          {kicker}
        </div>
        <div
          className="font-display text-[19px] text-white"
          style={{ lineHeight: '23px', marginTop: 2 }}
        >
          {title}
        </div>
        <div className="text-[12.5px] text-white" style={{ opacity: 0.9, marginTop: 2 }}>
          {sub}
        </div>
      </div>
      <ChevronRight size={22} color="#fff" />
    </div>
  </button>
);

const PowerMove: React.FC<{ icon: LucideIcon; gradient: string; title: string; sub: string }> = ({
  icon: I,
  gradient,
  title,
  sub,
}) => (
  <div
    className="flex-1 rounded-2xl p-3.5"
    style={{ background: sa.card, border: `1px solid ${sa.border}`, height: 134 }}
  >
    <div
      className="grid place-items-center"
      style={{ width: 40, height: 40, borderRadius: 12, background: gradient }}
    >
      <I size={21} color="#fff" />
    </div>
    <div className="mt-2.5">
      <div className="font-display text-[14px]" style={{ lineHeight: '17px' }}>
        {title}
      </div>
      <div className="mt-0.5 text-[11px]" style={{ color: sa.inkMuted }}>
        {sub}
      </div>
    </div>
  </div>
);

const NUTRITION = {
  pct: 1840 / 2400,
  center: '1840',
  centerSub: '/2400kcal',
  headline: '560',
  unit: 'kcal',
  sub: '560 remaining · on track',
  from: sa.accentSoft,
  to: sa.accent,
  kicker: 'Calories',
  kickerIcon: Flame,
};
const ACTIVITY = {
  pct: 0.82,
  center: '8,240',
  centerSub: '/10,000',
  headline: '1,760',
  unit: 'steps',
  sub: 'to your daily goal',
  from: '#2EE6A6',
  to: '#059669',
  kicker: 'Steps',
  kickerIcon: BarChart3,
};
const RECOVERY = {
  pct: 7.5 / 8,
  center: '7.5h',
  centerSub: '/8h',
  headline: '7.5h',
  unit: '',
  sub: 'Slept last night',
  from: '#A5B4FC',
  to: '#4F46E5',
  kicker: 'Sleep',
  kickerIcon: Clock,
};

export const TodayScreen: React.FC = () => {
  const [page, setPage] = React.useState(0);
  const pages = ['Nutrition', 'Activity', 'Recovery'];
  const hero = page === 0 ? NUTRITION : page === 1 ? ACTIVITY : RECOVERY;

  return (
    <Body>
      <div className="px-5 pt-2">
        {/* Brand bar */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center">
            <div
              className="mr-2 grid h-9 w-9 place-items-center rounded-2xl"
              style={{ background: sa.raised, border: `1px solid ${sa.border}` }}
            >
              <Apple size={18} color={sa.ink} />
            </div>
            <span className="text-2xl font-extrabold tracking-tight">Sahha</span>
          </div>
          <div
            className="flex items-center rounded-full px-3 py-1.5"
            style={{ background: sa.raised, border: `1px solid ${sa.border}` }}
          >
            <Flame size={14} color="#F97316" />
            <span className="ml-1.5 text-base font-extrabold">12</span>
          </div>
        </div>

        {/* Greeting */}
        <div className="mb-5">
          <span className="text-sm" style={{ color: sa.inkSub }}>
            Good morning
          </span>
          <div className="mt-0.5 font-display tracking-tight" style={{ fontSize: 27 }}>
            Let’s lift.
          </div>
        </div>

        {/* Week strip */}
        <div className="mb-4 flex items-center justify-between">
          {DAY_LABELS.map((d, i) => {
            const isToday = i === TODAY_IDX;
            const isFuture = i > TODAY_IDX;
            return (
              <div key={d} className="flex flex-1 flex-col items-center gap-1.5">
                <DayRing value={isFuture ? 0 : DAY_COMPLETION[i]} active={isToday} dim={isFuture} />
                <span
                  className="text-[11px] font-bold"
                  style={{ color: isToday ? sa.accentBright : sa.inkMuted }}
                >
                  {d}
                </span>
              </div>
            );
          })}
        </div>

        {/* Pager tabs */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex gap-4">
            {pages.map((label, i) => (
              <button
                key={label}
                onClick={() => setPage(i)}
                className="font-display text-lg tracking-tight"
                style={{ color: page === i ? sa.ink : sa.inkMuted }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: page === i ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: page === i ? sa.accentBright : 'rgba(180,180,194,0.3)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Hero + macros */}
        <HeroCard
          pct={hero.pct}
          from={hero.from}
          to={hero.to}
          id={`hero-${page}`}
          center={hero.center}
          centerSub={hero.centerSub}
          kicker={hero.kicker}
          kickerIcon={hero.kickerIcon}
          headline={hero.headline}
          unit={hero.unit}
          sub={hero.sub}
        />

        {page === 0 && (
          <div className="mb-4 flex gap-3">
            <MacroCard
              value={96}
              target={160}
              label="Protein"
              from="#FB7185"
              to="#E11D48"
              id="mp"
            />
            <MacroCard value={180} target={280} label="Carbs" from="#F5C451" to="#D97706" id="mc" />
            <MacroCard value={52} target={75} label="Fat" from="#60A5FA" to="#1D4ED8" id="mf" />
          </div>
        )}
        {page === 1 && (
          <div className="mb-4 flex gap-3">
            <MacroCard
              value={28}
              target={30}
              label="Active min"
              from="#FB923C"
              to="#EA580C"
              id="am"
              unit=""
            />
            <BioCard value="2" unit="" label="Workouts" color="#A855F7" icon={Medal} />
            <BioCard value="5.2" unit="km" label="Distance" color="#22D3EE" icon={Ruler} />
          </div>
        )}
        {page === 2 && (
          <div className="mb-4 flex gap-3">
            <BioCard value="58" unit="bpm" label="Resting HR" color="#F43F5E" icon={Heart} />
            <BioCard value="62" unit="ms" label="HRV" color="#60A5FA" icon={TrendingUp} />
            <BioCard value="78" unit="kg" label="Weight" color="#FCD34D" icon={Scale} />
          </div>
        )}

        {/* CTA */}
        <CTACard
          gradient={`linear-gradient(135deg, #FF6B8A, ${sa.accentDeep})`}
          glow={sa.accentDeep}
          icon={Camera}
          kicker="AI Meal · Vision"
          title="Snap a meal"
          sub="Photo → calories, macros, instant"
        />

        {/* Power moves */}
        <div
          className="mb-3 text-xs font-bold uppercase"
          style={{ letterSpacing: 2.5, color: sa.inkMuted }}
        >
          Power moves
        </div>
        <div className="flex gap-2.5">
          <PowerMove
            icon={TrendingUp}
            gradient={`linear-gradient(135deg, ${sa.accentSoft}, ${sa.accentEnd})`}
            title="Weekly review"
            sub="+12% volume"
          />
          <PowerMove
            icon={Apple}
            gradient="linear-gradient(135deg, #A3E635, #16A34A)"
            title="What to eat"
            sub="Macro-fit meals"
          />
          <PowerMove
            icon={Camera}
            gradient="linear-gradient(135deg, #34E89E, #12B886)"
            title="AI Scan"
            sub="Any machine"
          />
        </div>
      </div>
    </Body>
  );
};

/* ============================================================ COACH */

const Bubble: React.FC<{ user?: boolean; children: React.ReactNode }> = ({ user, children }) => (
  <div className={user ? 'flex flex-col items-end' : 'flex flex-col items-start'}>
    {!user && (
      <div className="mb-1.5 ml-1 flex items-center">
        <div
          className="mr-1.5 grid h-5 w-5 place-items-center rounded-full"
          style={{ background: 'rgba(255,77,46,0.2)' }}
        >
          <Sparkles size={10} color={sa.cyan} />
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: sa.inkSub }}
        >
          Coach
        </span>
      </div>
    )}
    <div
      className="max-w-[86%] px-4 py-3 text-[15px]"
      style={
        user
          ? {
              background: sa.accent,
              color: '#fff',
              borderRadius: 24,
              borderBottomRightRadius: 6,
              lineHeight: '22px',
            }
          : {
              background: sa.raised,
              border: `1px solid ${sa.border}`,
              color: sa.ink,
              borderRadius: 24,
              borderBottomLeftRadius: 6,
              lineHeight: '22px',
            }
      }
    >
      {children}
    </div>
  </div>
);

export const CoachScreen: React.FC = () => (
  <div className="flex h-full flex-col" style={{ background: sa.bg, color: sa.ink }}>
    <StatusBar />
    {/* Header */}
    <div className="flex items-center justify-between px-5 pt-2 pb-2">
      <span className="font-display text-2xl tracking-tight">AI Coach</span>
      <div className="flex gap-2">
        <button
          className="grid h-9 w-9 place-items-center rounded-full"
          style={{ background: sa.raised, border: `1px solid ${sa.border}` }}
        >
          <History size={16} color={sa.inkSub} />
        </button>
        <button
          className="grid h-9 w-9 place-items-center rounded-full"
          style={{ background: sa.accent }}
        >
          <Plus size={16} color="#fff" />
        </button>
      </div>
    </div>

    {/* Context strip */}
    <div
      className="mx-4 mb-2 flex items-center rounded-full px-3 py-2"
      style={{ background: sa.raised, border: '1px solid rgba(255,77,46,0.25)' }}
    >
      <div
        className="grid h-5 w-5 place-items-center rounded-full"
        style={{ background: 'rgba(255,77,46,0.2)' }}
      >
        <Sparkles size={11} color={sa.cyan} />
      </div>
      <span className="ml-2 flex-1 truncate text-[11px]" style={{ color: sa.inkSub }}>
        Using your last 7 days · 5 workouts · 12d streak
      </span>
    </div>

    {/* Messages */}
    <div className="hide-scroll flex-1 space-y-3 overflow-y-auto px-4 pt-1">
      <Bubble user>My shoulder feels off today, swap the overhead press?</Bubble>
      <Bubble>
        Got it 💪 Let’s swap to a <b>landmine press</b> — easier on the shoulder. I kept your 4×10
        and added a band warm-up. Updated today’s plan.
      </Bubble>
      <Bubble user>Perfect. How are my macros looking?</Bubble>
      <Bubble>
        You’re at <b>96g protein</b> of 160. To hit it: a chicken-and-rice bowl (~45g) plus a shake
        closes the gap. Carbs and fat are right on target.
      </Bubble>
    </div>

    {/* Composer */}
    <div className="px-4 pb-5 pt-2">
      <div
        className="flex items-end rounded-3xl py-1.5 pl-1.5 pr-1.5"
        style={{ background: sa.raised, border: `1px solid ${sa.border}` }}
      >
        <div
          className="grid h-10 w-10 place-items-center self-end rounded-full"
          style={{ background: sa.card, border: `1px solid ${sa.border}` }}
        >
          <ImageIcon size={18} color={sa.inkSub} />
        </div>
        <div
          className="ml-1.5 grid h-10 w-10 place-items-center self-end rounded-full"
          style={{ background: sa.card, border: `1px solid ${sa.border}` }}
        >
          <Camera size={18} color={sa.inkSub} />
        </div>
        <div className="flex-1 px-3 py-2.5 text-[15px]" style={{ color: sa.inkMuted }}>
          Ask your coach…
        </div>
        <div
          className="grid h-10 w-10 place-items-center self-end rounded-full"
          style={{ background: sa.accent }}
        >
          <ArrowUp size={18} color="#fff" />
        </div>
      </div>
    </div>
  </div>
);

/* ============================================================ PROGRESS */

const accentBar = (strong = false) => (
  <div style={{ height: 1, display: 'flex' }}>
    <div style={{ flex: 1 }} />
    <div style={{ flex: 2, background: strong ? '#FF4D2E66' : '#FF4D2E33' }} />
    <div style={{ flex: 1 }} />
  </div>
);

const DeltaPill: React.FC<{ value: string; tone?: 'up' | 'down' | 'flat' }> = ({
  value,
  tone = 'up',
}) => {
  const color = tone === 'up' ? sa.success : tone === 'down' ? sa.danger : sa.inkSub;
  const bg =
    tone === 'up'
      ? 'rgba(52,211,153,0.12)'
      : tone === 'down'
        ? 'rgba(248,113,113,0.12)'
        : 'rgba(161,161,170,0.1)';
  const border =
    tone === 'up'
      ? 'rgba(52,211,153,0.3)'
      : tone === 'down'
        ? 'rgba(248,113,113,0.3)'
        : 'rgba(161,161,170,0.22)';
  return (
    <span
      className="self-start rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase"
      style={{ color, background: bg, border: `1px solid ${border}`, letterSpacing: 1 }}
    >
      {value}
    </span>
  );
};

const BigStat: React.FC<{
  label: string;
  value: string;
  unit?: string;
  icon: LucideIcon;
  delta?: string;
  accent?: boolean;
}> = ({ label, value, unit, icon: I, delta, accent }) => (
  <div
    className="flex-1 overflow-hidden rounded-[26px]"
    style={{
      background: sa.card,
      border: `1px solid ${accent ? 'rgba(255,77,46,0.3)' : sa.border}`,
    }}
  >
    {accentBar(accent)}
    <div className="p-3.5">
      <div className="mb-3 flex items-center justify-between">
        <span
          className="flex-1 text-[10px] font-extrabold uppercase"
          style={{ letterSpacing: 1.2, color: sa.inkMuted }}
        >
          {label}
        </span>
        <div
          className="grid place-items-center"
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: accent
              ? `linear-gradient(135deg, ${sa.warning}, ${sa.accentSoft})`
              : `linear-gradient(135deg, ${sa.accentSoft}, ${sa.accentEnd})`,
          }}
        >
          <I size={16} color="#fff" />
        </div>
      </div>
      <div className="flex items-baseline">
        <span className="font-display tracking-tight" style={{ fontSize: 28, lineHeight: '32px' }}>
          {value}
        </span>
        {unit && (
          <span className="ml-1 text-sm font-bold" style={{ color: sa.inkMuted }}>
            {unit}
          </span>
        )}
      </div>
      {delta && (
        <div className="mt-2">
          <DeltaPill value={delta} />
        </div>
      )}
    </div>
  </div>
);

const MiniStat: React.FC<{ icon: LucideIcon; label: string; value: string }> = ({
  icon: I,
  label,
  value,
}) => (
  <div
    className="flex-1 rounded-[20px] px-3 py-3"
    style={{ background: sa.card, border: `1px solid ${sa.border}` }}
  >
    <div className="mb-1.5 flex items-center gap-1.5">
      <I size={12} color={sa.inkSub} />
      <span
        className="text-[10px] font-extrabold uppercase"
        style={{ letterSpacing: 1, color: sa.inkMuted }}
      >
        {label}
      </span>
    </div>
    <span className="font-display text-xl tracking-tight">{value}</span>
  </div>
);

const VolumeChart: React.FC = () => {
  const bars = [38, 44, 40, 52, 48, 60, 56, 68, 64, 78, 72, 92];
  const W = 320;
  const H = 130;
  const pad = 6;
  const n = bars.length;
  const bw = (W - pad * 2) / n;
  const pts = bars.map(
    (v, i) => [pad + bw * i + bw / 2, H - pad - (v / 100) * (H - pad * 2 - 8)] as const,
  );
  const line = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(' ');
  const last = pts[pts.length - 1];
  const first = pts[0];
  const area = `${line} L${last[0].toFixed(1)} ${H} L${first[0].toFixed(1)} ${H} Z`;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id="volArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF7A1A" stopOpacity={0.35} />
          <stop offset="1" stopColor="#FF2D55" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="volLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FF8A2B" />
          <stop offset="1" stopColor="#FF2D55" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#volArea)" />
      <path
        d={line}
        fill="none"
        stroke="url(#volLine)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={9} fill="#FF2D55" opacity={0.25} />
      <circle cx={last[0]} cy={last[1]} r={4} fill="#fff" stroke="#FF2D55" strokeWidth={2} />
    </svg>
  );
};

const Panel: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div
    className={`overflow-hidden rounded-[26px] ${className}`}
    style={{ background: sa.card, border: `1px solid ${sa.border}` }}
  >
    {accentBar()}
    <div style={{ padding: 18 }}>{children}</div>
  </div>
);

const IconBadge: React.FC<{ icon: LucideIcon }> = ({ icon: I }) => (
  <div
    className="mr-3 grid place-items-center rounded-2xl"
    style={{
      width: 44,
      height: 44,
      background: 'rgba(255,77,46,0.12)',
      border: '1px solid rgba(255,77,46,0.28)',
    }}
  >
    <I size={20} color={sa.accent} />
  </div>
);

export const ProgressScreen: React.FC = () => (
  <Body>
    <div className="px-5 pt-2">
      <div className="mb-6">
        <div
          className="mb-1.5 text-[11px] font-extrabold uppercase"
          style={{ letterSpacing: 1.4, color: sa.inkMuted }}
        >
          Your stats
        </div>
        <div className="text-3xl font-extrabold tracking-tight">Progress</div>
      </div>

      <div className="mb-4 flex gap-2.5">
        <BigStat label="Total volume" value="48.2k" unit="kg" icon={TrendingUp} delta="+12%" />
        <BigStat label="Best session" value="12.4k" unit="kg" icon={Medal} accent />
      </div>

      <div className="mb-5 flex gap-2.5">
        <MiniStat icon={Dumbbell} label="Workouts" value="146" />
        <MiniStat icon={Clock} label="This week" value="4" />
        <MiniStat icon={Flame} label="Streak" value="12d" />
      </div>

      <Panel className="mb-3">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex-1 pr-3">
            <div
              className="mb-1 text-[10px] font-extrabold uppercase"
              style={{ letterSpacing: 1.4, color: sa.inkMuted }}
            >
              Last 12 weeks
            </div>
            <div className="text-lg font-extrabold tracking-tight">Weekly volume</div>
          </div>
          <DeltaPill value="+12%" />
        </div>
        <VolumeChart />
        <div className="mt-2.5 flex gap-1.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 text-center text-[9px] font-bold"
              style={{ color: sa.inkMuted }}
            >
              W{i + 1}
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="mb-3">
        <div className="mb-3 flex items-center">
          <IconBadge icon={Medal} />
          <div className="flex-1">
            <div
              className="text-[10px] font-extrabold uppercase"
              style={{ letterSpacing: 1.4, color: sa.inkMuted }}
            >
              Personal records
            </div>
            <div className="mt-0.5 text-base font-extrabold tracking-tight">3 new this month</div>
          </div>
        </div>
        <div className="space-y-2">
          {[
            ['Deadlift', '140 kg × 5'],
            ['Bench press', '92.5 kg × 3'],
            ['Back squat', '120 kg × 5'],
          ].map(([n, v]) => (
            <div
              key={n}
              className="flex items-center justify-between rounded-xl px-3 py-2"
              style={{ background: sa.raised, border: `1px solid ${sa.border}` }}
            >
              <span className="text-[13px]" style={{ color: sa.inkSub }}>
                {n}
              </span>
              <span className="text-[13px] font-extrabold">{v}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="mb-3">
        <div className="mb-4 flex items-center">
          <IconBadge icon={Ruler} />
          <div className="flex-1">
            <div
              className="text-[10px] font-extrabold uppercase"
              style={{ letterSpacing: 1.4, color: sa.inkMuted }}
            >
              Body
            </div>
            <div className="mt-0.5 text-base font-extrabold tracking-tight">Measurements</div>
          </div>
        </div>
        <div className="flex gap-2.5">
          {[
            ['Weight', '78', 'kg'],
            ['Height', '180', 'cm'],
          ].map(([l, v, u]) => (
            <div
              key={l}
              className="flex-1 rounded-[20px] px-3.5 py-3.5"
              style={{ background: sa.raised, border: `1px solid ${sa.border}` }}
            >
              <div
                className="mb-1.5 text-[10px] font-extrabold uppercase"
                style={{ letterSpacing: 1.2, color: sa.inkMuted }}
              >
                {l}
              </div>
              <div className="flex items-baseline">
                <span className="font-display text-2xl tracking-tight">{v}</span>
                <span className="ml-1 text-xs font-bold" style={{ color: sa.inkMuted }}>
                  {u}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  </Body>
);

/* ============================================================ COMMUNITY / FEED */

const PostCard: React.FC<{
  name: string;
  handle: string;
  time: string;
  avatar: string;
  text: string;
  likes: number;
  comments: number;
  liked?: boolean;
  badge?: string;
}> = ({ name, handle, time, avatar, text, likes, comments, liked, badge }) => {
  const [isLiked, setLiked] = React.useState(!!liked);
  return (
    <div
      className="mb-3 overflow-hidden rounded-[26px]"
      style={{ background: sa.card, border: `1px solid ${sa.border}` }}
    >
      <div className="flex items-center px-4 pb-3 pt-4">
        <div
          className="grid h-[42px] w-[42px] place-items-center rounded-full text-base font-extrabold text-white"
          style={{ background: avatar }}
        >
          {name[0]}
        </div>
        <div className="ml-3 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-bold">{name}</span>
            {badge && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[8px] font-extrabold"
                style={{ background: 'rgba(255,77,46,0.15)', color: sa.accent }}
              >
                {badge}
              </span>
            )}
          </div>
          <span className="text-xs" style={{ color: sa.inkMuted }}>
            @{handle} · {time}
          </span>
        </div>
        <button
          className="grid h-9 w-9 place-items-center rounded-full"
          style={{ background: sa.elevated, border: `1px solid ${sa.border}` }}
        >
          <MoreHorizontal size={18} color={sa.inkSub} />
        </button>
      </div>
      <p className="px-4 pb-3 text-[15px]" style={{ lineHeight: '21px' }}>
        {text}
      </p>
      <div className="flex items-center px-4 pb-4 pt-1">
        <button onClick={() => setLiked((v) => !v)} className="mr-5 flex items-center py-1">
          <Heart
            size={20}
            color={isLiked ? sa.danger : sa.inkMuted}
            fill={isLiked ? sa.danger : 'none'}
          />
          <span className="ml-1.5 text-[13px] font-semibold">{likes + (isLiked ? 1 : 0)}</span>
        </button>
        <button className="mr-5 flex items-center py-1">
          <MessageCircle size={20} color={sa.inkMuted} />
          <span className="ml-1.5 text-[13px] font-semibold">{comments}</span>
        </button>
        <div className="flex-1" />
        <button className="py-1">
          <Bookmark size={20} color={sa.inkMuted} />
        </button>
      </div>
    </div>
  );
};

export const CommunityScreen: React.FC = () => {
  const [filter, setFilter] = React.useState(0);
  const filters = ['For you', 'Following', 'PRs', 'Nutrition'];
  return (
    <div className="flex h-full flex-col" style={{ background: sa.bg, color: sa.ink }}>
      <StatusBar />
      <div className="flex items-center justify-between px-5 pb-3 pt-2">
        <div>
          <div
            className="mb-1 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: sa.inkMuted }}
          >
            The crew
          </div>
          <div className="text-3xl font-extrabold tracking-tight">Feed</div>
        </div>
        <button
          className="grid h-11 w-11 place-items-center rounded-full"
          style={{ background: sa.raised, border: `1px solid ${sa.border}` }}
        >
          <Bookmark size={20} color={sa.inkSub} />
        </button>
      </div>

      <div className="hide-scroll flex shrink-0 gap-2 overflow-x-auto px-5 pb-3.5">
        {filters.map((label, i) => {
          const active = filter === i;
          return (
            <button
              key={label}
              onClick={() => setFilter(i)}
              className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold"
              style={
                active
                  ? { background: sa.ink, color: sa.bg, border: `1px solid ${sa.ink}` }
                  : { background: sa.elevated, color: sa.inkSub, border: `1px solid ${sa.border}` }
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      <div
        className="hide-scroll relative flex-1 overflow-y-auto px-5"
        style={{ paddingBottom: 116 }}
      >
        <PostCard
          name="Yasmine"
          handle="yas.lifts"
          time="2h"
          avatar="linear-gradient(135deg,#f472b6,#db2777)"
          badge="🔥 30-day"
          text="Hit a new squat PR this morning — 110kg for 3! Sahha’s coach nudged me to add 2.5kg and it paid off."
          likes={48}
          comments={12}
          liked
        />
        <PostCard
          name="Karim"
          handle="karim.fit"
          time="4h"
          avatar="linear-gradient(135deg,#FF8A2B,#FF2D55)"
          text="Week 6 of my AI-generated program. Down 4kg, up on every lift. The walkthrough mode is unreal."
          likes={31}
          comments={8}
        />
        <PostCard
          name="Lina"
          handle="lina.moves"
          time="6h"
          avatar="linear-gradient(135deg,#60a5fa,#4f46e5)"
          text="Form Check caught my rounding back on deadlifts 👀 fixed it instantly."
          likes={27}
          comments={5}
        />
      </div>

      <button
        className="absolute right-5 grid h-14 w-14 place-items-center rounded-full"
        style={{
          bottom: 104,
          background: `linear-gradient(135deg, ${sa.accentSoft}, ${sa.accent}, ${sa.accentEnd})`,
          boxShadow: `0 6px 16px -2px ${sa.accent}80`,
          zIndex: 30,
        }}
      >
        <Plus size={26} color="#fff" />
      </button>
    </div>
  );
};

/* ============================================================ PROFILE */

const SettingRow: React.FC<{ icon: LucideIcon; label: string; value?: string }> = ({
  icon: I,
  label,
  value,
}) => (
  <div
    className="flex items-center rounded-2xl px-4 py-3.5"
    style={{ background: sa.card, border: `1px solid ${sa.border}` }}
  >
    <div
      className="mr-3 grid h-8 w-8 place-items-center rounded-xl"
      style={{ background: sa.elevated }}
    >
      <I size={16} color={sa.inkSub} />
    </div>
    <span className="flex-1 text-[15px] font-semibold">{label}</span>
    {value && (
      <span className="mr-2 text-[13px]" style={{ color: sa.inkMuted }}>
        {value}
      </span>
    )}
    <ChevronRight size={18} color={sa.inkDim} />
  </div>
);

export const ProfileScreen: React.FC = () => (
  <Body>
    <div className="px-5 pt-2">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div
            className="mb-1 text-[10px] font-bold uppercase"
            style={{ letterSpacing: 1.4, color: sa.inkMuted }}
          >
            Profile
          </div>
          <div className="font-display text-3xl tracking-tight">Profile</div>
        </div>
        <button
          className="grid h-10 w-10 place-items-center rounded-full"
          style={{ background: sa.raised, border: `1px solid ${sa.border}` }}
        >
          <Bell size={18} color={sa.inkSub} />
        </button>
      </div>

      {/* Identity card */}
      <div
        className="mb-4 rounded-[26px] p-4"
        style={{ background: sa.card, border: `1px solid ${sa.border}` }}
      >
        <div className="flex items-center">
          <div
            className="mr-4 grid h-16 w-16 place-items-center rounded-2xl text-2xl font-extrabold text-white"
            style={{ background: sa.accent, boxShadow: `0 6px 14px -2px ${sa.accent}66` }}
          >
            A
          </div>
          <div className="flex-1">
            <div className="flex items-center">
              <span className="text-lg font-extrabold tracking-tight">Adam Carter</span>
              <span
                className="ml-2 flex items-center rounded-full px-2 py-0.5"
                style={{ background: 'rgba(255,77,46,0.15)' }}
              >
                <Crown size={10} color={sa.accent} />
                <span
                  className="ml-1 text-[9px] font-extrabold uppercase tracking-wider"
                  style={{ color: sa.accent }}
                >
                  Pro
                </span>
              </span>
            </div>
            <div className="mt-0.5 text-xs" style={{ color: sa.inkSub }}>
              @adam.carter
            </div>
            <div className="mt-1 text-[10px]" style={{ color: sa.inkMuted }}>
              Member since Jan 2026
            </div>
          </div>
          <ChevronRight size={16} color={sa.inkSub} />
        </div>
        <div className="mt-4 flex gap-2 border-t pt-4" style={{ borderColor: sa.border }}>
          {[
            ['Height', '180', 'cm'],
            ['Weight', '78', 'kg'],
            ['Goal', 'Build', ''],
            ['Level', 'Inter.', ''],
          ].map(([l, v, u]) => (
            <div key={l} className="flex-1">
              <div
                className="text-[9px] font-bold uppercase"
                style={{ letterSpacing: 0.6, color: sa.inkMuted }}
              >
                {l}
              </div>
              <div className="mt-0.5 flex items-baseline">
                <span className="text-sm font-extrabold">{v}</span>
                {u && (
                  <span className="ml-0.5 text-[10px]" style={{ color: sa.inkMuted }}>
                    {u}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Premium banner */}
      <div
        className="mb-5 overflow-hidden rounded-[26px] p-5"
        style={{ background: '#161210', border: '1px solid rgba(245,196,81,0.35)' }}
      >
        <div className="flex items-center">
          <div
            className="mr-3 grid h-11 w-11 place-items-center rounded-xl"
            style={{ background: `linear-gradient(135deg, ${sa.warning}, ${sa.accentSoft})` }}
          >
            <Crown size={20} color="#1A1410" />
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-extrabold">Sahha Pro</div>
            <div className="text-xs" style={{ color: sa.inkSub }}>
              Unlimited AI coaching & scans
            </div>
          </div>
          <ChevronRight size={18} color={sa.warning} />
        </div>
      </div>

      {/* Settings */}
      <div className="space-y-2.5">
        <SettingRow icon={User} label="Account" value="adam@sahha.app" />
        <SettingRow icon={Target} label="Goals & targets" />
        <SettingRow icon={Bell} label="Notifications" />
        <SettingRow icon={Apple} label="Apple Health" value="Connected" />
      </div>
    </div>
  </Body>
);

/* ============================================================ SCAN (feature) */

const HeroPill: React.FC<{ dot: string; label: string }> = ({ dot, label }) => (
  <span
    className="flex items-center rounded-full px-2.5 py-1"
    style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.25)' }}
  >
    <span className="mr-1.5 rounded-full" style={{ width: 6, height: 6, background: dot }} />
    <span className="text-[10px] font-extrabold uppercase tracking-wide text-white">{label}</span>
  </span>
);

const ScanSection: React.FC<{
  icon: LucideIcon;
  label: string;
  color?: string;
  children: React.ReactNode;
}> = ({ icon: I, label, color = sa.accent, children }) => (
  <div
    className="mb-3 rounded-[20px] p-4"
    style={{ background: sa.card, border: `1px solid ${sa.border}` }}
  >
    <div className="mb-3 flex items-center gap-2">
      <div
        className="grid place-items-center"
        style={{
          width: 24,
          height: 24,
          borderRadius: 8,
          background: `${color}1A`,
          border: `1px solid ${color}33`,
        }}
      >
        <I size={12} color={color} />
      </div>
      <span
        className="text-[10px] font-extrabold uppercase"
        style={{ letterSpacing: 1.4, color: sa.inkMuted }}
      >
        {label}
      </span>
    </div>
    {children}
  </div>
);

export const ScanScreen: React.FC = () => (
  <Body pb={20}>
    <div className="px-4 pt-1">
      {/* Header */}
      <div className="mb-3 flex items-center">
        <button
          className="grid h-9 w-9 place-items-center rounded-full"
          style={{ background: sa.raised, border: `1px solid ${sa.border}` }}
        >
          <X size={16} color={sa.inkSub} />
        </button>
        <span className="ml-3 text-lg font-extrabold tracking-tight">Scan results</span>
      </div>

      {/* Hero gradient */}
      <div
        className="mb-3 overflow-hidden rounded-[26px]"
        style={{
          border: `1px solid ${sa.border}`,
          boxShadow: '0 8px 24px -8px rgba(255,77,46,0.4)',
        }}
      >
        <div
          style={{ background: 'linear-gradient(135deg, #3F0F0F, #9F2D17, #FF4D2E)', padding: 18 }}
        >
          <div className="flex items-start">
            <div
              className="grid place-items-center rounded-2xl"
              style={{
                width: 56,
                height: 56,
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.25)',
              }}
            >
              <Dumbbell size={26} color="#fff" />
            </div>
            <div className="ml-3 flex-1">
              <div
                className="mb-1 text-[10px] font-extrabold uppercase text-white/80"
                style={{ letterSpacing: 1.2 }}
              >
                Free weight
              </div>
              <div
                className="text-2xl font-extrabold tracking-tight text-white"
                style={{ lineHeight: '28px' }}
              >
                Adjustable Dumbbell
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <HeroPill dot={sa.warning} label="Intermediate" />
            <HeroPill dot={sa.success} label="High confidence" />
          </div>
        </div>
      </div>

      {/* Muscles */}
      <ScanSection icon={Target} label="Muscles targeted">
        <div className="flex flex-wrap gap-1.5">
          {['Chest', 'Shoulders', 'Triceps'].map((m) => (
            <span
              key={m}
              className="rounded-full px-3 py-1 text-xs font-bold"
              style={{
                background: 'rgba(255,77,46,0.15)',
                border: '1px solid rgba(255,77,46,0.3)',
                color: sa.accent,
              }}
            >
              {m}
            </span>
          ))}
          {['Core', 'Forearms'].map((m) => (
            <span
              key={m}
              className="rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: sa.card, border: `1px solid ${sa.border}`, color: sa.inkSub }}
            >
              {m}
            </span>
          ))}
        </div>
      </ScanSection>

      {/* How to use */}
      <ScanSection icon={Play} label="How to use">
        <div className="space-y-3">
          {[
            'Sit on a flat bench, dumbbells at shoulder height.',
            'Press up until arms are extended, elbows soft.',
            'Lower under control to a full stretch.',
          ].map((step, i) => (
            <div key={i} className="flex items-start">
              <div
                className="mr-3 grid place-items-center rounded-xl"
                style={{
                  width: 30,
                  height: 30,
                  background: sa.elevated,
                  border: `1px solid ${sa.border}`,
                }}
              >
                <span className="text-sm font-extrabold" style={{ color: sa.accent }}>
                  {i + 1}
                </span>
              </div>
              <span className="flex-1 pt-1 text-[14px]" style={{ lineHeight: '20px' }}>
                {step}
              </span>
            </div>
          ))}
        </div>
      </ScanSection>

      {/* Pro tip */}
      <div
        className="rounded-[20px] p-4"
        style={{ background: '#F5C4510F', border: '1px solid #F5C45133' }}
      >
        <div className="mb-1.5 flex items-center gap-2">
          <Sparkles size={16} color={sa.warning} />
          <span
            className="text-[10px] font-extrabold uppercase"
            style={{ letterSpacing: 1.4, color: sa.warning }}
          >
            Pro tip
          </span>
        </div>
        <p className="text-[14px]" style={{ lineHeight: '20px' }}>
          Keep a slight arch and drive your feet into the floor for a stronger, safer press.
        </p>
      </div>
    </div>
  </Body>
);

/* ============================================================ WORKOUT (feature) */

export const WorkoutScreen: React.FC = () => {
  const accent = '#F97316';
  return (
    <Body pb={24}>
      <div className="px-5 pt-1">
        {/* Top bar */}
        <div className="mb-3 flex items-center justify-between">
          <button
            className="grid place-items-center rounded-full"
            style={{
              width: 36,
              height: 36,
              background: '#17171B',
              border: `1px solid ${sa.border}`,
            }}
          >
            <X size={16} color={sa.inkSub} />
          </button>
          <div className="flex items-center gap-1.5">
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: accent,
                boxShadow: `0 0 6px ${accent}`,
              }}
            />
            <span
              className="text-[10px] font-extrabold uppercase"
              style={{ letterSpacing: 1.2, color: accent }}
            >
              Live · Push Day
            </span>
          </div>
          <span
            className="text-[10px] font-extrabold"
            style={{ letterSpacing: 1.2, color: sa.inkMuted }}
          >
            2 / 6
          </span>
        </div>

        {/* Progress */}
        <div className="overflow-hidden rounded-full" style={{ height: 5, background: '#1F1F23' }}>
          <div style={{ height: '100%', width: '33%', background: accent, borderRadius: 999 }} />
        </div>

        {/* Exercise demo */}
        <div
          className="relative mt-4 overflow-hidden rounded-[26px]"
          style={{ height: 220, background: '#17171B', border: `1px solid ${sa.border}` }}
        >
          <div className="absolute inset-0 grid place-items-center">
            <Dumbbell size={72} color={sa.borderStrong} />
          </div>
          <div
            className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full px-2 py-1"
            style={{ background: 'rgba(0,0,0,0.55)' }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 3, background: accent }} />
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-white">
              Live demo
            </span>
          </div>
          <div
            className="absolute inset-x-0 bottom-0 p-4"
            style={{ background: 'linear-gradient(0deg, rgba(11,11,15,0.95), transparent)' }}
          >
            <div
              className="text-[10px] font-extrabold uppercase text-white/70"
              style={{ letterSpacing: 1.2 }}
            >
              Chest · Triceps
            </div>
            <div className="text-2xl font-extrabold tracking-tight text-white">Bench Press</div>
          </div>
        </div>

        {/* Sets */}
        <div className="mt-4 space-y-1.5">
          {[
            ['1', '80', '10', true],
            ['2', '85', '8', true],
            ['3', '85', '8', false],
            ['4', '85', '—', false],
          ].map(([n, w, reps, done]) => (
            <div
              key={n as string}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px]"
              style={{
                background: done ? 'rgba(255,77,46,0.1)' : sa.card,
                border: `1px solid ${sa.border}`,
              }}
            >
              <span className="w-4 font-bold" style={{ color: sa.inkMuted }}>
                {n}
              </span>
              <span className="flex-1 font-semibold">{w} kg</span>
              <span className="flex-1" style={{ color: sa.inkSub }}>
                {reps} reps
              </span>
              <div
                className="grid place-items-center rounded-md"
                style={{
                  width: 20,
                  height: 20,
                  background: done ? sa.accent : 'transparent',
                  border: done ? 'none' : `1px solid ${sa.borderStrong}`,
                }}
              >
                {done ? <Check size={12} color="#fff" strokeWidth={3} /> : null}
              </div>
            </div>
          ))}
        </div>

        {/* Nav buttons */}
        <div className="mt-4 flex gap-2.5">
          <button
            className="flex-1 rounded-2xl py-3 text-center text-[14px] font-bold"
            style={{ background: sa.card, border: `1px solid ${sa.border}`, color: sa.inkSub }}
          >
            Previous
          </button>
          <button
            className="flex-1 rounded-2xl py-3 text-center text-[14px] font-extrabold text-white"
            style={{ background: accent }}
          >
            Next exercise
          </button>
        </div>
      </div>
    </Body>
  );
};

/* ============================================================ REGISTRY */

export interface ScreenMeta {
  key: string;
  label: string;
  tagline: string;
  icon: LucideIcon;
  tab: TabKey | null;
  Screen: React.FC;
}

export const SCREENS: ScreenMeta[] = [
  {
    key: 'home',
    label: 'Today',
    tagline: 'Your day at a glance',
    icon: Home,
    tab: 'home',
    Screen: TodayScreen,
  },
  {
    key: 'coach',
    label: 'AI Coach',
    tagline: 'A coach that remembers you',
    icon: Sparkles,
    tab: 'coach',
    Screen: CoachScreen,
  },
  {
    key: 'progress',
    label: 'Progress',
    tagline: 'Watch the numbers climb',
    icon: TrendingUp,
    tab: 'progress',
    Screen: ProgressScreen,
  },
  {
    key: 'feed',
    label: 'Community',
    tagline: 'Train with the crew',
    icon: Users,
    tab: 'feed',
    Screen: CommunityScreen,
  },
  {
    key: 'profile',
    label: 'Profile',
    tagline: 'You, in numbers',
    icon: User,
    tab: 'profile',
    Screen: ProfileScreen,
  },
  {
    key: 'scan',
    label: 'AI Gym Scan',
    tagline: 'Scan any machine',
    icon: Camera,
    tab: null,
    Screen: ScanScreen,
  },
  {
    key: 'workout',
    label: 'Workout',
    tagline: 'Log every set',
    icon: Dumbbell,
    tab: null,
    Screen: WorkoutScreen,
  },
];

export const screenByKey = (k: string) => SCREENS.find((s) => s.key === k) ?? SCREENS[0];

export const TAB_TO_SCREEN: Record<TabKey, React.FC> = {
  home: TodayScreen,
  feed: CommunityScreen,
  coach: CoachScreen,
  progress: ProgressScreen,
  profile: ProfileScreen,
};
