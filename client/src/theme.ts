import { useColorScheme } from 'react-native';

// All colours and sizes live here. Text pairs meet 4.5:1 contrast.
const light = {
  ink: '#16211F',
  inkMuted: '#4A5A57',
  paper: '#FFFFFF',
  surface: '#FFFFFF',
  muted: '#EEF2F1',
  border: '#D5DDDB',
  accent: '#0B5F66',
  onAccent: '#FFFFFF',
  danger: '#A4262C',
};

const dark: typeof light = {
  ink: '#ECF2F1',
  inkMuted: '#B5C3C0',
  paper: '#0F1514',
  surface: '#18201F',
  muted: '#222C2B',
  border: '#33403E',
  accent: '#5EC4CB',
  onAccent: '#0F1514',
  danger: '#FF8A8F',
};

export type Colors = typeof light;
export const palettes = { light, dark };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { card: 8, pill: 999 } as const;
export const touchTarget = 44;

export const font = {
  regular: 'AtkinsonHyperlegible_400Regular',
  bold: 'AtkinsonHyperlegible_700Bold',
};
export const text = { tiny: 12, small: 14, body: 16, h3: 20, h2: 24, h1: 28 } as const;
export const lineHeight = 1.4;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}
