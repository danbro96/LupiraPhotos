import { Outlet } from 'react-router-dom';

/** Root outlet — the authed AppShell owns all chrome. */
export default function App() {
  return <Outlet />;
}
