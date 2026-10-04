import ListItemButton from '@mui/material/ListItemButton';
import type { ListItemButtonProps } from '@mui/material/ListItemButton';
import Box from '@mui/material/Box';
import type { ElementType, ReactNode } from 'react';

/** Divider-separated row of icon + name + trailing meta. Used for places, items and contacts. */
export function Row({ sx, component, ...props }: ListItemButtonProps & { component?: ElementType; to?: unknown }) {
  const merged = {
    ...props,
    sx: { gap: 1, py: 1, px: 1, borderBottom: 1, borderColor: 'divider', borderRadius: 1, ...sx },
  };
  return component ? <ListItemButton component={component} {...merged} /> : <ListItemButton {...merged} />;
}

/** The row's primary label: takes the slack and ellipsises. */
export function RowName({ children }: { children?: ReactNode }) {
  return (
    <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {children}
    </Box>
  );
}
