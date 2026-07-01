import Svg, { Path, Circle, Rect } from 'react-native-svg';

export type IconName =
  | 'dumbbell'
  | 'flame'
  | 'trending'
  | 'calendar'
  | 'chevron-right'
  | 'chevron-left'
  | 'chevron-down'
  | 'plus'
  | 'check'
  | 'check-circle'
  | 'search'
  | 'x'
  | 'mail'
  | 'lock'
  | 'eye'
  | 'eye-off'
  | 'user'
  | 'globe'
  | 'shield'
  | 'crown'
  | 'logout'
  | 'trash'
  | 'bell'
  | 'home'
  | 'bar-chart'
  | 'users'
  | 'play'
  | 'pause'
  | 'skip-forward'
  | 'skip-back'
  | 'music'
  | 'spotify'
  | 'history'
  | 'list'
  | 'edit'
  | 'target'
  | 'zap'
  | 'clock'
  | 'arrow-right'
  | 'arrow-up'
  | 'sparkles'
  | 'medal'
  | 'ruler'
  | 'scale'
  | 'heart'
  | 'message'
  | 'bookmark'
  | 'share'
  | 'image'
  | 'send'
  | 'more'
  | 'camera'
  | 'apple'
  | 'flask'
  | 'leaf'
  | 'droplet'
  | 'alert';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  filled?: boolean;
}

export function Icon({
  name,
  size = 20,
  color = '#F4F4F7',
  strokeWidth = 1.8,
  filled = false,
}: Props) {
  const sw = strokeWidth;
  const c = color;
  const common = {
    stroke: c,
    strokeWidth: sw,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: filled ? c : 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {paths(name, common, c)}
    </Svg>
  );
}

function paths(
  name: IconName,
  p: {
    stroke: string;
    strokeWidth: number;
    strokeLinecap: 'round';
    strokeLinejoin: 'round';
    fill: string;
  },
  c: string,
) {
  switch (name) {
    case 'dumbbell':
      return (
        <>
          <Path d="M2 12h2M20 12h2M6 8v8M18 8v8M9 6v12M15 6v12M9 12h6" {...p} />
        </>
      );
    case 'flame':
      return (
        <Path d="M12 3s4 4 4 8a4 4 0 1 1-8 0c0-1 .5-2 1-2.5C9 9 8 7 9 5c1 1 2 1 3-2Z" {...p} />
      );
    case 'trending':
      return (
        <>
          <Path d="M3 17l6-6 4 4 8-8" {...p} />
          <Path d="M17 7h4v4" {...p} />
        </>
      );
    case 'calendar':
      return (
        <>
          <Rect x="3" y="5" width="18" height="16" rx="2" {...p} />
          <Path d="M3 10h18M8 3v4M16 3v4" {...p} />
        </>
      );
    case 'chevron-right':
      return <Path d="M9 6l6 6-6 6" {...p} />;
    case 'chevron-left':
      return <Path d="M15 6l-6 6 6 6" {...p} />;
    case 'chevron-down':
      return <Path d="M6 9l6 6 6-6" {...p} />;
    case 'plus':
      return <Path d="M12 5v14M5 12h14" {...p} />;
    case 'check':
      return <Path d="M5 12l5 5L20 7" {...p} />;
    case 'check-circle':
      return (
        <>
          <Circle cx="12" cy="12" r="9" {...p} />
          <Path d="M8 12l3 3 5-6" {...p} />
        </>
      );
    case 'search':
      return (
        <>
          <Circle cx="11" cy="11" r="7" {...p} />
          <Path d="m20 20-3.5-3.5" {...p} />
        </>
      );
    case 'x':
      return <Path d="M6 6l12 12M18 6L6 18" {...p} />;
    case 'mail':
      return (
        <>
          <Rect x="3" y="5" width="18" height="14" rx="2" {...p} />
          <Path d="m4 8 8 5 8-5" {...p} />
        </>
      );
    case 'lock':
      return (
        <>
          <Rect x="4" y="10" width="16" height="11" rx="2" {...p} />
          <Path d="M8 10V7a4 4 0 0 1 8 0v3" {...p} />
        </>
      );
    case 'eye':
      return (
        <>
          <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" {...p} />
          <Circle cx="12" cy="12" r="3" {...p} />
        </>
      );
    case 'eye-off':
      return (
        <>
          <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" {...p} />
          <Circle cx="12" cy="12" r="3" {...p} />
          <Path d="M4 4l16 16" {...p} />
        </>
      );
    case 'user':
      return (
        <>
          <Circle cx="12" cy="8" r="4" {...p} />
          <Path d="M4 21a8 8 0 0 1 16 0" {...p} />
        </>
      );
    case 'globe':
      return (
        <>
          <Circle cx="12" cy="12" r="9" {...p} />
          <Path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" {...p} />
        </>
      );
    case 'shield':
      return <Path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" {...p} />;
    case 'crown':
      return <Path d="M3 7l4 5 5-7 5 7 4-5 1 13H2L3 7Z" {...p} />;
    case 'logout':
      return (
        <>
          <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" {...p} />
          <Path d="M16 17l5-5-5-5M21 12H10" {...p} />
        </>
      );
    case 'trash':
      return (
        <>
          <Path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" {...p} />
          <Path d="M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" {...p} />
          <Path d="M10 11v6M14 11v6" {...p} />
        </>
      );
    case 'bell':
      return (
        <>
          <Path d="M6 9a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8Z" {...p} />
          <Path d="M10 21a2 2 0 0 0 4 0" {...p} />
        </>
      );
    case 'home':
      return <Path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2v-9Z" {...p} />;
    case 'bar-chart':
      return (
        <>
          <Path d="M3 21h18" {...p} />
          <Rect x="5" y="11" width="3" height="8" rx="0.5" {...p} />
          <Rect x="10.5" y="6" width="3" height="13" rx="0.5" {...p} />
          <Rect x="16" y="14" width="3" height="5" rx="0.5" {...p} />
        </>
      );
    case 'users':
      return (
        <>
          <Circle cx="9" cy="8" r="4" {...p} />
          <Path d="M2 21a7 7 0 0 1 14 0" {...p} />
          <Path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-5-6.7" {...p} />
        </>
      );
    case 'play':
      return (
        <Path
          d="M7 5l13 7-13 7V5Z"
          stroke={c}
          strokeWidth={p.strokeWidth}
          strokeLinejoin="round"
          fill={c}
        />
      );
    case 'pause':
      return (
        <>
          <Rect
            x="6"
            y="5"
            width="4"
            height="14"
            rx="1"
            stroke={c}
            strokeWidth={p.strokeWidth}
            fill={c}
          />
          <Rect
            x="14"
            y="5"
            width="4"
            height="14"
            rx="1"
            stroke={c}
            strokeWidth={p.strokeWidth}
            fill={c}
          />
        </>
      );
    case 'skip-forward':
      return (
        <>
          <Path
            d="M5 5l10 7-10 7V5Z"
            stroke={c}
            strokeWidth={p.strokeWidth}
            strokeLinejoin="round"
            fill={c}
          />
          <Path d="M19 5v14" {...p} />
        </>
      );
    case 'skip-back':
      return (
        <>
          <Path
            d="M19 5L9 12l10 7V5Z"
            stroke={c}
            strokeWidth={p.strokeWidth}
            strokeLinejoin="round"
            fill={c}
          />
          <Path d="M5 5v14" {...p} />
        </>
      );
    case 'music':
      return (
        <>
          <Path d="M9 18V5l12-2v13" {...p} />
          <Circle cx="6" cy="18" r="3" {...p} />
          <Circle cx="18" cy="16" r="3" {...p} />
        </>
      );
    case 'spotify':
      return (
        <>
          <Circle cx="12" cy="12" r="10" {...p} />
          <Path
            d="M7 14.4c2.6-.9 6.4-.9 9 .6M7.4 11c3.1-1 7.2-.8 10 1M8 7.6c3.6-1 7.8-.4 10.6 1.5"
            stroke={c}
            strokeWidth={p.strokeWidth}
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
    case 'history':
      return (
        <>
          <Path d="M3 12a9 9 0 1 0 3-6.7L3 8" {...p} />
          <Path d="M3 3v5h5M12 7v5l3 2" {...p} />
        </>
      );
    case 'list':
      return <Path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" {...p} />;
    case 'edit':
      return <Path d="M4 20h4l11-11-4-4L4 16v4ZM14 6l4 4" {...p} />;
    case 'target':
      return (
        <>
          <Circle cx="12" cy="12" r="9" {...p} />
          <Circle cx="12" cy="12" r="5" {...p} />
          <Circle cx="12" cy="12" r="1.5" {...p} />
        </>
      );
    case 'zap':
      return <Path d="M13 2L4 14h7l-1 8 9-12h-7l1-8Z" {...p} />;
    case 'clock':
      return (
        <>
          <Circle cx="12" cy="12" r="9" {...p} />
          <Path d="M12 7v5l3 2" {...p} />
        </>
      );
    case 'arrow-right':
      return <Path d="M5 12h14M13 6l6 6-6 6" {...p} />;
    case 'arrow-up':
      return <Path d="M12 19V5M6 11l6-6 6 6" {...p} />;
    case 'sparkles':
      return (
        <Path
          d="M12 3l1.5 4 4 1.5-4 1.5L12 14l-1.5-4-4-1.5 4-1.5L12 3ZM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14ZM5 14l.6 1.4L7 16l-1.4.6L5 18l-.6-1.4L3 16l1.4-.6L5 14Z"
          {...p}
        />
      );
    case 'medal':
      return (
        <>
          <Circle cx="12" cy="15" r="6" {...p} />
          <Path d="M8 13L5 3h4l3 6M16 13l3-10h-4l-3 6" {...p} />
        </>
      );
    case 'ruler':
      return (
        <>
          <Path d="M21 8l-5-5L3 16l5 5L21 8Z" {...p} />
          <Path d="M7 17l-2-2M11 13l-2-2M15 9l-2-2M19 5l-2-2" {...p} />
        </>
      );
    case 'scale':
      return (
        <>
          <Rect x="3" y="4" width="18" height="16" rx="2" {...p} />
          <Path d="M9 10h6M12 8v4" {...p} />
        </>
      );
    case 'heart':
      return (
        <Path
          d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9Z"
          {...p}
        />
      );
    case 'message':
      return <Path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z" {...p} />;
    case 'bookmark':
      return <Path d="M6 4h12v17l-6-4-6 4V4Z" {...p} />;
    case 'share':
      return (
        <>
          <Circle cx="6" cy="12" r="3" {...p} />
          <Circle cx="18" cy="6" r="3" {...p} />
          <Circle cx="18" cy="18" r="3" {...p} />
          <Path d="M8.5 10.5l7-3M8.5 13.5l7 3" {...p} />
        </>
      );
    case 'image':
      return (
        <>
          <Rect x="3" y="4" width="18" height="16" rx="2" {...p} />
          <Circle cx="9" cy="10" r="2" {...p} />
          <Path d="M21 16l-5-5-9 9" {...p} />
        </>
      );
    case 'send':
      return <Path d="M3 11l18-8-7 19-3-8-8-3Z" {...p} />;
    case 'more':
      return (
        <>
          <Circle cx="5" cy="12" r="1.5" {...p} />
          <Circle cx="12" cy="12" r="1.5" {...p} />
          <Circle cx="19" cy="12" r="1.5" {...p} />
        </>
      );
    case 'camera':
      return (
        <>
          <Path
            d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"
            {...p}
          />
          <Circle cx="12" cy="13" r="4" {...p} />
        </>
      );
    case 'apple':
      return (
        <>
          <Path
            d="M12 7c-2-3-6-3-7 0-1 4 2 11 4 11 1 0 1.5-.5 3-.5s2 .5 3 .5c2 0 5-7 4-11-1-3-5-3-7 0Z"
            {...p}
          />
          <Path d="M12 7V4" {...p} />
        </>
      );
    case 'flask':
      return (
        <>
          <Path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 18l-5-9V3" {...p} />
          <Path d="M7 15h10" {...p} />
        </>
      );
    case 'leaf':
      return <Path d="M5 19c0-9 6-15 15-15 0 9-6 15-15 15ZM5 19l7-7" {...p} />;
    case 'droplet':
      return <Path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11Z" {...p} />;
    case 'alert':
      return (
        <>
          <Path d="M12 4 2 20h20L12 4Z" {...p} />
          <Path d="M12 10v4" {...p} />
          <Circle cx="12" cy="17" r="0.6" {...p} fill={c} />
        </>
      );
    default:
      return null;
  }
}
