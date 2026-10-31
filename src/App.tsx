import Home from './pages/Home';
import Learn from './pages/Learn';
import { I18nProvider } from './i18n';
import { useHash } from './route';

export default function App() {
  const learn = useHash().match(/^#\/learn(?:\/(\w+))?/);
  return (
    <I18nProvider>
      {learn ? <Learn tab={learn[1] ?? 'notes'} /> : <Home />}
    </I18nProvider>
  );
}
