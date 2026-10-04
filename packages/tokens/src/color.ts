import { darkColors as coreDark, lightColors as coreLight, type Palette as CorePalette } from '@danbro96/lupira-tokens-core/color';

export interface Palette extends CorePalette {
  warning: string;
  success: string;
}

export const lightColors: Palette = {
  ...coreLight,
  warning: '#b45309',
  success: '#1f7a4d',
};

export const darkColors: Palette = {
  ...coreDark,
  warning: '#d8b24a',
  success: '#5fd49b',
};

