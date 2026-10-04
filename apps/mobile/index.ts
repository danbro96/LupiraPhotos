// The crypto polyfill MUST load before any module that mints a UUID (Hermes has no global crypto).
import '@danbro96/lupira-expo-oidc/crypto';
// Before App, not after: App's imports register the headless backup task, and the generated clients
// resolve their transport at call time.
import './src/data/api/installTransport';
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
