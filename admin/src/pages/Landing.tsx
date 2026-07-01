import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Play,
  Pause,
  X,
  Bot,
  ScanLine,
  Video,
  Utensils,
  Wand2,
  Flame,
  Watch,
  Users as UsersIcon,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  Star,
  Hand,
  Apple,
  type LucideIcon,
} from 'lucide-react';
import { InteractivePhone, StaticPhone } from '@/components/landing/PhoneFrame';
import { SCREENS, type TabKey } from '@/components/landing/AppScreens';

const DEMO_VIDEO_URL = (import.meta.env.VITE_DEMO_VIDEO_URL as string | undefined) ?? '';

const GRAD = 'linear-gradient(135deg, #FF8A2B, #FF4D2E 55%, #FF2D55)';

/* ============================================================ NAV */

function Nav() {
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-white/5 bg-[#0A0A0F]/85 backdrop-blur-xl'
          : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <a href="#top" className="flex items-center gap-2.5">
          <div
            className="grid h-9 w-9 place-items-center rounded-2xl"
            style={{ background: '#1B1B25', border: '1px solid #21212B' }}
          >
            <Apple size={18} className="text-white" />
          </div>
          <div className="font-display text-xl font-bold tracking-tight text-white">Sahha</div>
        </a>

        <nav className="hidden items-center gap-7 text-[13px] font-medium text-white/55 md:flex">
          <a href="#screens" className="transition-colors hover:text-white">
            Screens
          </a>
          <a href="#demo" className="transition-colors hover:text-white">
            Demo
          </a>
          <a href="#features" className="transition-colors hover:text-white">
            Features
          </a>
        </nav>

        <Link
          to="/login"
          className="group inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold text-white transition-all hover:shadow-[0_0_30px_-6px_rgba(255,77,46,0.8)]"
          style={{ background: GRAD }}
        >
          <ShieldCheck size={15} />
          Connexion
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </header>
  );
}

/* ============================================================ HERO */

const TAB_SCREENS = SCREENS.filter((s) => s.tab !== null);

function Hero() {
  const [tab, setTab] = React.useState<TabKey>('home');
  const meta = TAB_SCREENS.find((s) => s.tab === tab) ?? TAB_SCREENS[0];

  return (
    <section id="top" className="relative overflow-hidden pt-32">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute left-1/2 top-[-10%] h-[560px] w-[560px] -translate-x-1/2 rounded-full"
          style={{ background: 'rgba(255,77,46,0.22)', filter: 'blur(150px)' }}
        />
        <div
          className="absolute right-[4%] top-[24%] h-[360px] w-[360px] rounded-full"
          style={{ background: 'rgba(255,45,85,0.12)', filter: 'blur(130px)' }}
        />
        <div
          className="absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '46px 46px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 75%)',
          }}
        />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="animate-rise-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] text-white/70">
            <span className="relative flex h-1.5 w-1.5">
              <span
                className="absolute h-1.5 w-1.5 animate-ping rounded-full"
                style={{ background: '#FF4D2E' }}
              />
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#FF4D2E' }} />
            </span>
            AI-native fitness, end to end
          </div>

          <h1 className="mt-5 font-display text-[2.7rem] font-bold leading-[1.04] tracking-tight text-white sm:text-6xl">
            The whole gym,
            <br />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: GRAD }}>
              in your pocket.
            </span>
          </h1>

          <p className="mt-5 max-w-md font-sahha text-[15px] leading-relaxed text-white/55">
            Sahha plans your training, coaches every rep, scans your gym, reads your meals, and
            tracks every metric — powered by an AI that actually remembers you.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href="#demo"
              className="group inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white transition-all hover:shadow-[0_0_40px_-8px_rgba(255,77,46,0.8)]"
              style={{ background: GRAD }}
            >
              <Play size={16} fill="currentColor" /> Watch the demo
            </a>
            <a
              href="#screens"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/5"
            >
              Explore the app <ChevronRight size={15} />
            </a>
          </div>

          <div className="mt-8 flex items-center gap-5 text-white/45">
            <div className="flex items-center gap-1" style={{ color: '#F5C451' }}>
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={13} fill="currentColor" />
              ))}
            </div>
            <span className="text-[12px]">Loved by lifters in 30+ countries</span>
          </div>
        </div>

        {/* navigable phone */}
        <div className="relative flex flex-col items-center">
          <InteractivePhone width={300} tab={tab} onTabChange={setTab} />

          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/55">
            <Hand size={12} className="text-[#FF7A1A]" /> Tap the tab bar — it really works
          </div>

          <div className="mt-4 flex max-w-xs flex-wrap items-center justify-center gap-2">
            {TAB_SCREENS.map((s) => {
              const on = s.tab === tab;
              return (
                <button
                  key={s.key}
                  onClick={() => setTab(s.tab as TabKey)}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all"
                  style={
                    on
                      ? {
                          borderColor: 'rgba(255,77,46,0.5)',
                          background: 'rgba(255,77,46,0.15)',
                          color: '#FF7A1A',
                        }
                      : {
                          borderColor: 'rgba(255,255,255,0.1)',
                          background: 'rgba(255,255,255,0.05)',
                          color: 'rgba(255,255,255,0.5)',
                        }
                  }
                >
                  <s.icon size={13} /> {s.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[12px] text-white/40">
            <span className="text-white/70">{meta.label}</span> — {meta.tagline}
          </p>
        </div>
      </div>

      <LogoMarquee />
    </section>
  );
}

function LogoMarquee() {
  const items = [
    'Apple Health',
    'Google Fit',
    'HealthKit',
    'Health Connect',
    'Wear OS',
    'WHOOP',
    'Garmin',
  ];
  const row = [...items, ...items];
  return (
    <div className="relative border-y border-white/5 bg-white/[0.015] py-5">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#0A0A0F] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#0A0A0F] to-transparent" />
      <div className="flex w-max animate-marquee items-center gap-12 px-6">
        {row.map((t, i) => (
          <div key={i} className="flex items-center gap-2 text-[13px] font-semibold text-white/25">
            <Watch size={15} /> {t}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================ SCREENS GALLERY */

function ScreensSection() {
  const [active, setActive] = React.useState('coach');
  return (
    <section id="screens" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
      <SectionHeading
        eyebrow="Every screen"
        title="The real app, screen by screen"
        sub="Pick any screen — the phone updates live. Pixel-for-pixel what your members see."
      />

      <div className="mt-12 grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="order-2 flex justify-center lg:order-1">
          <div className="animate-float-slow">
            <StaticPhone key={active} screenKey={active} width={300} pointer />
          </div>
        </div>

        <div className="order-1 grid grid-cols-3 gap-4 sm:grid-cols-4 lg:order-2 lg:grid-cols-3">
          {SCREENS.map((s) => {
            const on = s.key === active;
            return (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                className="group relative flex flex-col items-center gap-3 rounded-2xl border p-4 text-center transition-all"
                style={
                  on
                    ? { borderColor: 'rgba(255,77,46,0.4)', background: 'rgba(255,77,46,0.1)' }
                    : {
                        borderColor: 'rgba(255,255,255,0.08)',
                        background: 'rgba(255,255,255,0.02)',
                      }
                }
              >
                <div
                  className={`transition-transform duration-300 ${on ? 'scale-100' : 'scale-95 opacity-80 group-hover:scale-100 group-hover:opacity-100'}`}
                >
                  <StaticPhone screenKey={s.key} width={92} glow={false} />
                </div>
                <div
                  className="flex items-center justify-center gap-1 text-[12px] font-semibold"
                  style={{ color: on ? '#FF7A1A' : 'rgba(255,255,255,0.7)' }}
                >
                  <s.icon size={12} /> {s.label}
                </div>
                {on && (
                  <span
                    className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full"
                    style={{ background: '#FF4D2E', boxShadow: '0 0 8px 2px rgba(255,77,46,0.6)' }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ============================================================ DEMO */

function DemoSection() {
  const [open, setOpen] = React.useState(false);
  return (
    <section id="demo" className="relative scroll-mt-20 overflow-hidden py-24">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute left-1/2 top-1/2 h-[420px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: 'rgba(255,77,46,0.1)', filter: 'blur(140px)' }}
        />
      </div>
      <div className="mx-auto max-w-5xl px-5">
        <SectionHeading
          eyebrow="See it in action"
          title="A 60-second tour of Sahha"
          sub="Watch a member go from scanning their gym to a finished, logged workout."
        />

        <button
          onClick={() => setOpen(true)}
          className="group relative mx-auto mt-12 block w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 p-1"
          style={{
            background: 'linear-gradient(160deg, #14141C, #0A0A0F)',
            boxShadow: '0 30px 90px -30px rgba(255,77,46,0.5)',
          }}
        >
          <div
            className="relative flex aspect-video items-center justify-center overflow-hidden rounded-[1.4rem]"
            style={{ background: '#0A0A0F' }}
          >
            <div className="absolute inset-0 flex items-center justify-center gap-6 opacity-40 blur-[2px]">
              <div className="translate-y-6 rotate-[-8deg]">
                <StaticPhone screenKey="home" width={150} glow={false} />
              </div>
              <div className="-translate-y-4">
                <StaticPhone screenKey="coach" width={160} glow={false} />
              </div>
              <div className="translate-y-6 rotate-[8deg]">
                <StaticPhone screenKey="progress" width={150} glow={false} />
              </div>
            </div>
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(0deg, #0A0A0F, transparent 60%)' }}
            />
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div
                className="grid h-20 w-20 place-items-center rounded-full text-white transition-transform duration-300 group-hover:scale-110"
                style={{ background: GRAD, boxShadow: '0 0 50px -6px rgba(255,77,46,0.9)' }}
              >
                <Play size={30} fill="currentColor" className="ml-1" />
              </div>
              <div className="rounded-full bg-black/50 px-3 py-1 text-[12px] font-medium text-white/80 backdrop-blur">
                Play product tour · 0:58
              </div>
            </div>
          </div>
        </button>
      </div>

      {open && <DemoModal onClose={() => setOpen(false)} />}
    </section>
  );
}

function DemoModal({ onClose }: { onClose: () => void }) {
  const steps: { screen: string; title: string; body: string }[] = [
    {
      screen: 'scan',
      title: '1 · Scan your gym',
      body: 'Point your camera — AI identifies the machine, the muscles it hits, and how to use it.',
    },
    {
      screen: 'coach',
      title: '2 · Talk to your coach',
      body: 'Your AI coach remembers past sessions and tailors today around how you feel.',
    },
    {
      screen: 'home',
      title: '3 · Start your day',
      body: 'Rings, streaks and your planned session — everything front and center.',
    },
    {
      screen: 'workout',
      title: '4 · Train & log',
      body: 'Live demos, set tracking, rest timers and smart progression suggestions.',
    },
    {
      screen: 'progress',
      title: '5 · Watch progress',
      body: 'Estimated 1RMs, PRs and body metrics climbing week over week.',
    },
    {
      screen: 'feed',
      title: '6 · Share the win',
      body: 'Post PRs, climb the weekly leaderboard, train with your crew.',
    },
  ];
  const [i, setI] = React.useState(0);
  const [playing, setPlaying] = React.useState(true);

  React.useEffect(() => {
    if (DEMO_VIDEO_URL || !playing) return;
    const t = setTimeout(() => setI((p) => (p + 1) % steps.length), 3400);
    return () => clearTimeout(t);
  }, [i, playing, steps.length]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const step = steps[i];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10"
        style={{ background: '#0A0A0F' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
        >
          <X size={17} />
        </button>

        {DEMO_VIDEO_URL ? (
          <video src={DEMO_VIDEO_URL} controls autoPlay className="aspect-video w-full bg-black" />
        ) : (
          <div className="grid gap-6 p-8 sm:grid-cols-[auto_1fr] sm:items-center sm:p-10">
            <div className="flex justify-center">
              <StaticPhone key={step.screen} screenKey={step.screen} width={232} />
            </div>
            <div>
              <div
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-white"
                style={{ background: 'rgba(255,77,46,0.15)', color: '#FF7A1A' }}
              >
                <Video size={12} /> Product tour
              </div>
              <h3 className="mt-4 font-display text-2xl font-bold text-white">{step.title}</h3>
              <p className="mt-2 max-w-sm font-sahha text-[14px] leading-relaxed text-white/55">
                {step.body}
              </p>

              <div className="mt-6 flex items-center gap-2">
                {steps.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setI(idx)}
                    className="h-1.5 overflow-hidden rounded-full bg-white/10"
                    style={{ width: idx === i ? 36 : 14 }}
                  >
                    {idx === i && (
                      <span className="block h-full w-full" style={{ background: '#FF4D2E' }} />
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={() => setPlaying((p) => !p)}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-bold text-[#0A0A0F]"
                >
                  {playing ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
                  {playing ? 'Pause' : 'Play'}
                </button>
                <span className="text-[13px] font-medium text-white/40">
                  {i + 1} / {steps.length}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================ FEATURES */

const FEATURES: { icon: LucideIcon; title: string; body: string; color: string }[] = [
  {
    icon: Bot,
    title: 'AI Coach with memory',
    body: 'A conversational coach that recalls your history, injuries and goals across every chat.',
    color: '#22D3EE',
  },
  {
    icon: ScanLine,
    title: 'AI Gym Scan',
    body: 'Point your camera at any machine and get muscles, setup, how-to and a built workout.',
    color: '#A855F7',
  },
  {
    icon: Video,
    title: 'Form Check',
    body: 'Record a lift and get frame-by-frame technique feedback to train safer.',
    color: '#FF4D6D',
  },
  {
    icon: Utensils,
    title: 'Meal Parsing',
    body: 'Snap or describe a meal — AI breaks down calories and macros instantly.',
    color: '#FF8A2B',
  },
  {
    icon: Wand2,
    title: 'Program Generator',
    body: 'Full multi-week programs generated and auto-adjusted to your progress.',
    color: '#B06BFF',
  },
  {
    icon: Flame,
    title: 'Streaks & Progression',
    body: 'Daily streaks, PR tracking and smart next-session suggestions keep momentum.',
    color: '#FF7A1A',
  },
  {
    icon: UsersIcon,
    title: 'Community & Leaderboards',
    body: 'Follow friends, share PRs and climb weekly leaderboards together.',
    color: '#F472B6',
  },
  {
    icon: Watch,
    title: 'Wearables Sync',
    body: 'Steps, heart rate, sleep and calories from Apple Health & Health Connect.',
    color: '#2BD2FF',
  },
  {
    icon: TrendingUp,
    title: 'Deep Progress',
    body: 'Estimated 1RMs, body measurements, progress photos and volume trends.',
    color: '#2EE6A6',
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
      <SectionHeading
        eyebrow="What's inside"
        title="One app. The entire training stack."
        sub="Nine AI-powered pillars that replace a coach, a nutritionist and a logbook."
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02] p-6 transition-all hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.04]"
          >
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity group-hover:opacity-100"
              style={{ background: `${f.color}22` }}
            />
            <div
              className="mb-4 inline-grid h-11 w-11 place-items-center rounded-xl"
              style={{ background: 'rgba(255,255,255,0.05)', color: f.color }}
            >
              <f.icon size={20} strokeWidth={2.2} />
            </div>
            <h3 className="font-display text-[15px] font-bold text-white">{f.title}</h3>
            <p className="mt-1.5 font-sahha text-[13px] leading-relaxed text-white/50">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================ STATS */

function StatsBand() {
  const stats = [
    { v: '9', l: 'AI-powered tools' },
    { v: '36+', l: 'Data models tracked' },
    { v: '100%', l: 'Row-level secured' },
    { v: '24/7', l: 'Coach availability' },
  ];
  return (
    <section className="border-y border-white/5 bg-white/[0.015]">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-px px-5 py-14 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.l} className="text-center">
            <div className="bg-gradient-to-b from-white to-white/50 bg-clip-text font-display text-4xl font-bold text-transparent sm:text-5xl">
              {s.v}
            </div>
            <div className="mt-2 text-[12px] uppercase tracking-wider text-white/40">{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================ CTA + FOOTER */

function FinalCTA() {
  return (
    <section className="relative overflow-hidden px-5 py-28">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute left-1/2 top-1/2 h-[420px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: 'rgba(255,77,46,0.2)', filter: 'blur(140px)' }}
        />
      </div>
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] text-white/70">
          <Sparkles size={13} className="text-[#FF7A1A]" /> Start today
        </div>
        <h2 className="mt-5 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Your strongest year
          <br />
          starts now.
        </h2>
        <p className="mx-auto mt-4 max-w-md font-sahha text-[15px] text-white/55">
          One app for training, coaching, nutrition and recovery — built around an AI that learns
          you. The whole gym, in your pocket.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#demo"
            className="group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-white transition-all hover:shadow-[0_0_50px_-8px_rgba(255,77,46,0.9)]"
            style={{ background: GRAD }}
          >
            <Play size={16} fill="currentColor" /> Watch the demo
          </a>
          <a
            href="#screens"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/5"
          >
            Explore the app <ChevronRight size={15} />
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5 px-5 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <div
            className="grid h-8 w-8 place-items-center rounded-lg"
            style={{ background: '#1B1B25', border: '1px solid #21212B' }}
          >
            <Apple size={16} className="text-white" />
          </div>
          <span className="font-display text-sm font-semibold text-white">Sahha</span>
          <span className="text-[12px] text-white/35">· AI Fitness OS</span>
        </div>
        <div className="flex items-center gap-6 text-[12px] text-white/40">
          <a href="#screens" className="hover:text-white">
            Screens
          </a>
          <a href="#demo" className="hover:text-white">
            Demo
          </a>
          <a href="#features" className="hover:text-white">
            Features
          </a>
        </div>
        <div className="text-[12px] text-white/30">© {new Date().getFullYear()} Sahha</div>
      </div>
    </footer>
  );
}

/* ============================================================ SHARED */

function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#FF7A1A]">
        {eyebrow}
      </div>
      <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
      <p className="mt-3 font-sahha text-[15px] leading-relaxed text-white/50">{sub}</p>
    </div>
  );
}

/* ============================================================ PAGE */

export default function Landing() {
  return (
    <div
      className="min-h-screen font-sahha text-white antialiased"
      style={{ background: '#0A0A0F' }}
    >
      <Nav />
      <main>
        <Hero />
        <ScreensSection />
        <DemoSection />
        <StatsBand />
        <FeaturesSection />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
