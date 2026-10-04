import { ProgressBar } from 'react-native-paper';

/** Thin sweeping activity bar — cursor paging has no total, so this is deliberately indeterminate. */
export function IndeterminateBar() {
  return <ProgressBar indeterminate />;
}
