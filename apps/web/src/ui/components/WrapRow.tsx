import Stack from '@mui/material/Stack';
import type { StackProps } from '@mui/material/Stack';
import type { ElementType } from 'react';

// alignItems/flexWrap are sx-only in v9; useFlexGap because margin spacing breaks once the row wraps.
const SX = { my: 1, alignItems: 'center', flexWrap: 'wrap' } as const;

/** Wrapping horizontal row — form controls, chips. Pass component="form" to submit from the row. */
export function WrapRow({ sx, component, ...props }: StackProps & { component?: ElementType }) {
  const merged = { direction: 'row', spacing: 1, useFlexGap: true, sx: { ...SX, ...sx }, ...props } as const;
  return component ? <Stack component={component} {...merged} /> : <Stack {...merged} />;
}
