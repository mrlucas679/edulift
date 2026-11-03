import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, type StyleProp, type ViewStyle } from 'react-native';

// Motion rules, from the library's frontend-motion-and-animation note:
// animate only opacity and transform (§2), keep it short because these play many times a
// day (§5), and when "reduce motion" is on, fade instead of moving rather than dropping
// the feedback (§3).
const DURATION = 200;
const RISE = 8;
// The web has no native driver; there Animated runs in JavaScript.
const native = Platform.OS !== 'web';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => undefined);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => listener.remove();
  }, []);
  return reduced;
}

// Fades in and rises a little when it first shows. With reduce motion: fades only.
export function Appear({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const [shown] = useState(() => new Animated.Value(0));
  useEffect(() => {
    // A hidden browser tab runs no animation frames; show content at once rather than never.
    if (!native && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      shown.setValue(1);
      return;
    }
    Animated.timing(shown, {
      toValue: 1,
      duration: DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: native,
    }).start();
  }, [shown]);
  const translateY = reduced ? 0 : shown.interpolate({ inputRange: [0, 1], outputRange: [RISE, 0] });
  return <Animated.View style={[style, { opacity: shown, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

// A slow breathing fade for "working on it". With reduce motion: stays still.
export function Pulse({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const [level] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(level, { toValue: 0.4, duration: 600, useNativeDriver: native }),
        Animated.timing(level, { toValue: 1, duration: 600, useNativeDriver: native }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [level, reduced]);
  return <Animated.View style={{ opacity: level }}>{children}</Animated.View>;
}

// A pressed button or card shrinks a touch, so a tap feels answered.
export const pressedScale = (pressed: boolean, reduced: boolean) =>
  pressed && !reduced ? [{ scale: 0.97 }] : [];
