import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { langName } from '../lang';
import { socket } from '../socket';
import type { Message, Profile, Thread } from '../types';
import { Composer } from './Composer';
import { MessageBubble } from './MessageBubble';

type Props = { thread: Thread; me: Profile; onBack: () => void };

export function ThreadView({ thread, me, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const others = thread.members.filter((m) => m.id !== me.id);
  const members = useMemo(() => new Map(thread.members.map((m) => [m.id, m])), [thread.members]);

  // Insert or replace by id: the same message arrives as "new" then "updated" once translated.
  const upsert = useCallback(
    (msg: Message) => {
      if (msg.threadId !== thread.id) return;
      setMessages((prev) => {
        const i = prev.findIndex((p) => p.id === msg.id);
        if (i === -1) return [...prev, msg];
        const next = prev.slice();
        next[i] = msg;
        return next;
      });
    },
    [thread.id],
  );

  useEffect(() => {
    let cancelled = false;
    api
      .messages(thread.id)
      .then((m) => !cancelled && setMessages(m))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));

    const join = () => socket.emit('thread:join', thread.id);
    join();
    socket.on('connect', join); // rejoin after reconnects
    socket.on('message:new', upsert);
    socket.on('message:updated', upsert);
    return () => {
      cancelled = true;
      socket.emit('thread:leave', thread.id);
      socket.off('connect', join);
      socket.off('message:new', upsert);
      socket.off('message:updated', upsert);
    };
  }, [thread.id, upsert]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  return (
    <section className="thread">
      <header className="thread-header">
        <button className="back" onClick={onBack} aria-label="Back to conversations">‹</button>
        <div>
          <h2>{others.map((o) => o.displayName).join(', ')}</h2>
          <p className="muted">
            They read {others.map((o) => langName(o.language)).join(', ')}. You read {langName(me.language)}.
          </p>
        </div>
      </header>

      <div className="messages" role="log" aria-live="polite">
        {loading && <p className="muted center">Loading messages…</p>}
        {error && <p className="notice">Couldn't load messages: {error}</p>}
        {!loading && !error && messages.length === 0 && (
          <p className="muted center">Say hello. Your message will arrive in their language.</p>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} me={me} members={members} />
        ))}
        <div ref={bottomRef} />
      </div>

      <Composer
        placeholder={`Message in ${langName(me.language)}`}
        onSendText={(text) => api.sendText(thread.id, me.id, text).then(upsert)}
        onSendVoice={(audio) => api.sendVoice(thread.id, me.id, audio).then(upsert)}
      />
    </section>
  );
}
