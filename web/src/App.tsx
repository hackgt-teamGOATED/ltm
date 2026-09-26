import { useEffect, useState } from 'react';
import { api } from './api';
import { langName } from './lang';
import type { Profile, Thread } from './types';
import { ProfilePicker } from './components/ProfilePicker';
import { ThreadView } from './components/ThreadView';

// sessionStorage (not localStorage) so each browser tab can be a different person during demos.
// A ?as=<name or id> URL param wins over it (used by split.html and handy for demo links).
const ME_KEY = 'meId';
const asParam = new URLSearchParams(window.location.search).get('as');

const matches = (p: Profile, key: string | null) =>
  Boolean(key) && (p.id === key || p.displayName.toLowerCase() === key!.toLowerCase());

export default function App() {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [meId, setMeId] = useState<string | null>(() => asParam ?? sessionStorage.getItem(ME_KEY));
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.profiles().then(setProfiles).catch((e: Error) => setError(e.message));
  }, []);

  const me = profiles?.find((p) => matches(p, meId)) ?? null;

  useEffect(() => {
    if (!me) return;
    api
      .threads(me.id)
      .then((t) => {
        setThreads(t);
        setActiveId((current) => current ?? t[0]?.id ?? null);
      })
      .catch((e: Error) => setError(e.message));
  }, [me?.id]);

  const pick = (id: string | null) => {
    if (id) sessionStorage.setItem(ME_KEY, id);
    else sessionStorage.removeItem(ME_KEY);
    const url = new URL(window.location.href);
    url.searchParams.delete('as');
    window.history.replaceState(null, '', url);
    setThreads([]);
    setActiveId(null);
    setMeId(id);
  };

  if (error) {
    return (
      <div className="center-screen">
        <p className="notice">Can't reach the server: {error}. Check that it's running on the API URL in web/.env.</p>
      </div>
    );
  }
  if (!profiles) return <div className="center-screen"><p className="muted">Loading…</p></div>;
  if (!me) return <ProfilePicker profiles={profiles} onPick={pick} />;

  const active = threads.find((t) => t.id === activeId) ?? null;

  return (
    <div className={`app ${active ? 'has-active' : ''}`}>
      <aside className="sidebar">
        <header className="sidebar-header">
          <div>
            <h1>{me.displayName}</h1>
            <p className="muted">Reading and writing in {langName(me.language)}</p>
          </div>
          <button className="link-button" onClick={() => pick(null)}>Switch person</button>
        </header>
        <nav aria-label="Conversations">
          {threads.length === 0 && <p className="muted pad">No conversations yet.</p>}
          {threads.map((t) => {
            const others = t.members.filter((m) => m.id !== me.id);
            return (
              <button
                key={t.id}
                className={`thread-item ${t.id === activeId ? 'active' : ''}`}
                onClick={() => setActiveId(t.id)}
                aria-current={t.id === activeId}
              >
                <span className="thread-name">{others.map((o) => o.displayName).join(', ')}</span>
                <span className="muted">{others.map((o) => langName(o.language)).join(', ')}</span>
              </button>
            );
          })}
        </nav>
      </aside>
      <main className="chat">
        {active ? (
          <ThreadView key={active.id} thread={active} me={me} onBack={() => setActiveId(null)} />
        ) : (
          <div className="center-screen"><p className="muted">Choose a conversation to start.</p></div>
        )}
      </main>
    </div>
  );
}
