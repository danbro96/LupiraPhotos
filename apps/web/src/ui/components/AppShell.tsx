import { NavLink, Outlet } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import { SIBLING_HOSTS } from '../../config/siblings';

const SIBLINGS = [
  { href: SIBLING_HOSTS.cal, label: 'Calendar' },
  { href: SIBLING_HOSTS.maps, label: 'Map' },
];

// NavLink sets .active itself, so the current section needs no state.
// textTransform because Button uppercases, which is an affordance for actions, not for nav labels.
const NAV_LINK_SX = {
  color: 'text.secondary',
  fontWeight: 600,
  textTransform: 'none',
  '&.active': { bgcolor: 'background.paper', color: 'text.primary' },
};

/** Full-width app frame: the nav, with the sibling apps beside Photos, and the routed content. */
export function AppShell() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar variant="dense">
          <Stack component="nav" direction="row" spacing={1} sx={{ flex: 1 }}>
            <Button component={NavLink} to="/" end sx={NAV_LINK_SX}>Photos</Button>
            {SIBLINGS.map(({ href, label }) => (
              <Button key={label} component="a" href={href} sx={NAV_LINK_SX}>{label}</Button>
            ))}
          </Stack>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ flex: 1, minHeight: 0, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
