import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Glow } from './Glow';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  glow?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  // Optional sticky footer rendered outside the scroll area but inside the
  // safe-area frame. Use for primary CTAs that should stay pinned.
  footer?: ReactNode;
  // Defaults to 'handled'. Set to 'always' on screens with a TextInput +
  // a primary CTA below it: 'handled' can swallow the first tap on a Pressable
  // while the keyboard is up; 'always' lets every tap go through.
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  glow = false,
  edges = ['top', 'left', 'right'],
  footer,
  keyboardShouldPersistTaps = 'handled',
}: Props) {
  const inner = <View className={`flex-1 ${padded ? 'px-5 pt-4' : ''}`}>{children}</View>;
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={edges}>
      {glow ? (
        <>
          <Glow color="#FF4D2E" size={300} opacity={0.14} top={-100} right={-80} />
          <Glow color="#A855F7" size={260} opacity={0.08} bottom={-100} left={-80} />
        </>
      ) : null}
      {scroll ? (
        <ScrollView
          contentContainerClassName="flex-grow pb-6"
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          showsVerticalScrollIndicator={false}
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
      {footer}
    </SafeAreaView>
  );
}
