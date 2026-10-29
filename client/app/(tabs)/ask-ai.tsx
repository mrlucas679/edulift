import { Redirect } from 'expo-router';

// The tab opens the Ask screen on top, so Back returns to where the learner was.
export default function AskTab() {
  return <Redirect href="/ask" />;
}
