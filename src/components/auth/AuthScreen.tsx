import { useState } from 'react';
import { login, signup } from '../../lib/api';
import type { SessionUser } from '../../lib/api';

type Props = {
  onAuthed: (user: SessionUser) => void;
};

type Mode = 'login' | 'signup';

const PHONE_RE = /^[+\d()\s-]{6,20}$/;

export function AuthScreen({ onAuthed }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await login(username.trim(), password);
      onAuthed(user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login fejlede';
      setError(message.includes('Forkert') ? message : 'Forkert brugernavn eller kode');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignupSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Adgangskode skal være mindst 8 tegn');
      return;
    }
    if (password !== confirmPassword) {
      setError('Adgangskoder matcher ikke');
      return;
    }
    if (!PHONE_RE.test(phone.trim())) {
      setError('Ugyldigt telefonnummer');
      return;
    }

    setLoading(true);
    try {
      const user = await signup({
        username: username.trim(),
        password,
        confirmPassword,
        email: email.trim(),
        phone: phone.trim(),
      });
      onAuthed(user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup fejlede';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          {mode === 'login' ? 'Log ind' : 'Opret bruger'}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {mode === 'login'
            ? 'Log ind for at åbne dit dashboard.'
            : 'Opret en konto for at få dit eget dashboard.'}
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
            {error}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="mt-5 space-y-3">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Brugernavn"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              required
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Adgangskode"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              required
            />
            <button
              disabled={loading}
              type="submit"
              className="w-full rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {loading ? 'Logger ind…' : 'Log ind'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignupSubmit} className="mt-5 space-y-3">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Brugernavn"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              required
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="Arbejdsmail"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              required
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Privat telefonnummer"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              required
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Adgangskode (min. 8 tegn)"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              required
            />
            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              placeholder="Bekræft adgangskode"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              required
            />
            <button
              disabled={loading}
              type="submit"
              className="w-full rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {loading ? 'Opretter…' : 'Opret bruger'}
            </button>
          </form>
        )}

        <button
          onClick={() => {
            setMode((m) => (m === 'login' ? 'signup' : 'login'));
            setError(null);
          }}
          className="mt-4 w-full text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
          type="button"
        >
          {mode === 'login' ? 'Opret bruger' : 'Tilbage til login'}
        </button>
      </div>
    </div>
  );
}
