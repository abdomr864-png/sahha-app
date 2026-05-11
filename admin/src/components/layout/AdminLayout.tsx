import * as React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  ClipboardList,
  Activity,
  TrendingUp,
  Image as ImageIcon,
  Apple,
  Droplets,
  Pill,
  Smile,
  Moon,
  Watch,
  UserPlus,
  Newspaper,
  Heart,
  MessageSquare,
  Trophy,
  MessagesSquare,
  Bot,
  Video,
  Wand2,
  CreditCard,
  Gauge,
  Settings,
  Flame,
  CalendarCheck,
  History,
  Sparkles,
  Layers,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth/AuthProvider';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/users', label: 'Users', icon: Users },
    ],
  },
  {
    label: 'Training',
    items: [
      { to: '/r/exercises', label: 'Exercises', icon: Dumbbell },
      { to: '/r/programs', label: 'Programs', icon: ClipboardList },
      { to: '/r/program_days', label: 'Program Days', icon: Layers },
      { to: '/r/program_exercises', label: 'Program Exercises', icon: Layers },
      { to: '/r/workouts', label: 'Workouts', icon: Activity },
      { to: '/r/workout_exercises', label: 'Workout Exercises', icon: Layers },
      { to: '/r/workout_sets', label: 'Workout Sets', icon: Layers },
    ],
  },
  {
    label: 'Progress',
    items: [
      { to: '/r/personal_records', label: 'Personal Records', icon: TrendingUp },
      { to: '/r/body_measurements', label: 'Body Measurements', icon: TrendingUp },
      { to: '/r/progress_photos', label: 'Progress Photos', icon: ImageIcon },
    ],
  },
  {
    label: 'Nutrition',
    items: [
      { to: '/r/foods', label: 'Foods', icon: Apple },
      { to: '/r/meals', label: 'Meals', icon: Apple },
      { to: '/r/meal_items', label: 'Meal Items', icon: Apple },
      { to: '/r/water_log', label: 'Water Log', icon: Droplets },
      { to: '/r/supplements', label: 'Supplements', icon: Pill },
      { to: '/r/supplement_logs', label: 'Supplement Logs', icon: Pill },
    ],
  },
  {
    label: 'Wellness',
    items: [
      { to: '/r/mood_log', label: 'Mood Log', icon: Smile },
      { to: '/r/sleep_log', label: 'Sleep Log', icon: Moon },
      { to: '/r/wearable_metrics', label: 'Wearable Metrics', icon: Watch },
    ],
  },
  {
    label: 'Social',
    items: [
      { to: '/r/follows', label: 'Follows', icon: UserPlus },
      { to: '/r/posts', label: 'Posts', icon: Newspaper },
      { to: '/r/post_likes', label: 'Likes', icon: Heart },
      { to: '/r/post_comments', label: 'Comments', icon: MessageSquare },
      { to: '/r/leaderboards_weekly', label: 'Leaderboards', icon: Trophy },
    ],
  },
  {
    label: 'AI',
    items: [
      { to: '/r/ai_conversations', label: 'AI Conversations', icon: MessagesSquare },
      { to: '/r/ai_messages', label: 'AI Messages', icon: Bot },
      { to: '/r/ai_form_checks', label: 'Form Checks', icon: Video },
      { to: '/r/ai_program_adjustments', label: 'Program Adjustments', icon: Wand2 },
    ],
  },
  {
    label: 'Streaks & Progression',
    items: [
      { to: '/r/user_streaks', label: 'User Streaks', icon: Flame },
      { to: '/r/streak_events', label: 'Streak Events', icon: CalendarCheck },
      { to: '/r/exercise_progression_log', label: 'Progression Log', icon: History },
      { to: '/r/next_session_suggestions', label: 'Next Session Suggestions', icon: Sparkles },
    ],
  },
  {
    label: 'Billing',
    items: [
      { to: '/r/subscriptions', label: 'Subscriptions', icon: CreditCard },
      { to: '/r/usage_counters', label: 'Usage Counters', icon: Gauge },
      { to: '/r/entitlement_rules', label: 'Entitlement Rules', icon: Settings },
    ],
  },
];

export default function AdminLayout() {
  const { user, signOut } = useAuth();
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const initials = (user?.email ?? '?').split('@')[0].slice(0, 2).toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-64 flex-col border-r border-border/60 bg-card/40 backdrop-blur">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-glow-primary">
            <Activity size={18} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight">Sahha</div>
            <div className="truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Admin
            </div>
          </div>
        </div>

        <div className="mx-3 mb-2 h-px bg-border/60" />

        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {sections.map((section) => {
            const isCollapsed = collapsed[section.label];
            return (
              <div key={section.label} className="mb-1">
                <button
                  onClick={() =>
                    setCollapsed((p) => ({ ...p, [section.label]: !p[section.label] }))
                  }
                  className="group flex w-full items-center justify-between px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80 transition-colors hover:text-foreground"
                >
                  <span>{section.label}</span>
                  <ChevronDown
                    size={12}
                    className={cn(
                      'transition-transform duration-200',
                      isCollapsed ? '-rotate-90' : '',
                    )}
                  />
                </button>
                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {section.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        className={({ isActive }) =>
                          cn(
                            'group relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-all',
                            isActive
                              ? 'bg-primary/10 text-foreground'
                              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                            )}
                            <item.icon
                              size={15}
                              className={cn(
                                'shrink-0 transition-colors',
                                isActive ? 'text-primary' : 'text-muted-foreground/80',
                              )}
                            />
                            <span className="truncate">{item.label}</span>
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Account footer */}
        <div className="border-t border-border/60 p-2">
          <div className="flex items-center gap-2 rounded-lg p-2 hover:bg-accent/40">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{user?.email}</div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-dot" />
                admin
              </div>
            </div>
            <button
              onClick={signOut}
              title="Sign out"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
