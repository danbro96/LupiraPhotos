import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

/** Divider-topped block in a detail drawer. `action` puts a control opposite the heading. */
export function DrawerSection({
  title,
  action,
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const heading = title != null && (
    <Typography
      variant="overline"
      component="h3"
      sx={{ display: 'block', mb: action ? 0 : 1, color: 'text.subtle' }}
    >
      {title}
    </Typography>
  );
  return (
    <Box component="section" sx={{ mt: 2, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
      {action ? (
        <Stack direction="row" sx={{ mb: 1, alignItems: 'center', justifyContent: 'space-between' }}>
          {heading}
          {action}
        </Stack>
      ) : (
        heading
      )}
      {children}
    </Box>
  );
}
