import * as React from 'react';
import { PhoneTabBar, TAB_TO_SCREEN, screenByKey, sa, type TabKey } from './AppScreens';

/**
 * Titanium phone bezel. Screens are authored at a fixed logical resolution and
 * the whole device is CSS-scaled to the requested `width`, so a 96px thumbnail
 * is a pixel-perfect miniature of the 300px hero — not a reflowed layout.
 */

const DEVICE_W = 348;
const DEVICE_H = 722;

const Shell: React.FC<{
  width: number;
  glow?: boolean;
  pointer?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ width, glow = true, pointer = false, children, className = '' }) => {
  const scale = width / DEVICE_W;
  return (
    <div className={`relative ${className}`} style={{ width, height: DEVICE_H * scale }}>
      {glow && (
        <div
          className="pointer-events-none absolute -inset-10 -z-10 rounded-[80px]"
          style={{ background: 'rgba(255,77,46,0.16)', filter: 'blur(70px)' }}
        />
      )}
      <div
        className="absolute left-0 top-0"
        style={{
          width: DEVICE_W,
          height: DEVICE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: pointer ? 'auto' : 'none',
        }}
      >
        {/* titanium frame */}
        <div
          className="h-full w-full rounded-[54px] p-[3px]"
          style={{
            background: 'linear-gradient(150deg, #5b5b62, #18181c 28%, #050507 70%, #2a2a30)',
            boxShadow: '0 40px 90px -25px rgba(0,0,0,0.85)',
          }}
        >
          <div className="h-full w-full rounded-[51px] bg-black p-[11px]">
            <div
              className="relative h-full w-full overflow-hidden rounded-[42px]"
              style={{ background: sa.bg }}
            >
              {/* dynamic island */}
              <div className="absolute left-1/2 top-[10px] z-30 h-[26px] w-[96px] -translate-x-1/2 rounded-full bg-black" />
              {children}
            </div>
          </div>
        </div>
        {/* side buttons */}
        <div
          className="absolute -left-[3px] top-[120px] h-8 w-[3px] rounded-l"
          style={{ background: '#3a3a40' }}
        />
        <div
          className="absolute -left-[3px] top-[170px] h-14 w-[3px] rounded-l"
          style={{ background: '#3a3a40' }}
        />
        <div
          className="absolute -left-[3px] top-[238px] h-14 w-[3px] rounded-l"
          style={{ background: '#3a3a40' }}
        />
        <div
          className="absolute -right-[3px] top-[200px] h-20 w-[3px] rounded-r"
          style={{ background: '#3a3a40' }}
        />
      </div>
    </div>
  );
};

/**
 * A fully navigable device: tap the bottom tab bar to switch real app screens.
 * Works uncontrolled (own state) or controlled (pass `tab` + `onTabChange`),
 * so external chips can drive it and the tab bar can drive the chips.
 */
export const InteractivePhone: React.FC<{
  width?: number;
  initialTab?: TabKey;
  tab?: TabKey;
  onTabChange?: (k: TabKey) => void;
  glow?: boolean;
  className?: string;
}> = ({ width = 300, initialTab = 'home', tab, onTabChange, glow = true, className }) => {
  const [internal, setInternal] = React.useState<TabKey>(initialTab);
  const active = tab ?? internal;
  const change = (k: TabKey) => {
    setInternal(k);
    onTabChange?.(k);
  };
  const Screen = TAB_TO_SCREEN[active];
  return (
    <Shell width={width} glow={glow} pointer className={className}>
      <div key={active} className="h-full w-full animate-screen-in">
        <Screen />
      </div>
      <PhoneTabBar active={active} onChange={change} />
    </Shell>
  );
};

/** Renders a single screen (used by the gallery). Tab screens get a static bar. */
export const StaticPhone: React.FC<{
  screenKey: string;
  width?: number;
  glow?: boolean;
  pointer?: boolean;
  className?: string;
}> = ({ screenKey, width = 280, glow = true, pointer = false, className }) => {
  const meta = screenByKey(screenKey);
  const Screen = meta.Screen;
  return (
    <Shell width={width} glow={glow} pointer={pointer} className={className}>
      <div className="h-full w-full">
        <Screen />
      </div>
      {meta.tab && <PhoneTabBar active={meta.tab} />}
    </Shell>
  );
};
