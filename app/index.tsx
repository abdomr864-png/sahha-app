import { Redirect } from 'expo-router';

// Default route — AuthGate in _layout sends signed-out users to (auth).
// Signed-in users land on the home tab.
export default function Index() {
  return <Redirect href="/(tabs)/" />;
}
