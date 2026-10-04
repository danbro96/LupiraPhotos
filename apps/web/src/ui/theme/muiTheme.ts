import { createLupiraMuiTheme } from '@danbro96/lupira-web-mui/theme';
import { PHONE_BREAKPOINT } from '@danbro96/lupira-tokens-core/breakpoints';
import { darkColors, lightColors } from '@lupira/photos-tokens/color';

export const theme = createLupiraMuiTheme({ light: lightColors, dark: darkColors }, {
  breakpoints: {
    // 'md' doubles as the phone breakpoint (down('md') === max-width PHONE_BREAKPOINT.95px);
    // responsive sx values key off it, and useIsPhone wraps the same query.
    values: { xs: 0, sm: 600, md: PHONE_BREAKPOINT + 1, lg: 1200, xl: 1536 },
  },
});
