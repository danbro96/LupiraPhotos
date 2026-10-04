import { createBrowserRouter } from 'react-router-dom';
import App from '../../App';
import { RequireAuth } from '@danbro96/lupira-web-session/RequireAuth';
import { Centered } from '@danbro96/lupira-web-mui/Centered';
import { AppShell } from '../components/AppShell';
import { PhotosScreen } from '../screens/PhotosScreen';

// Everything requires the SSO session — the BFF has no anonymous surface. The viewer rides the
// ?photo= search param, so a photo deep-links straight into it.
export const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      {
        element: <RequireAuth pending={(title) => <Centered title={title} />} />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <PhotosScreen /> },
              { path: '*', element: <PhotosScreen /> },
            ],
          },
        ],
      },
    ],
  },
]);
