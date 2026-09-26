import { langName } from '../lang';
import type { Profile } from '../types';

export function ProfilePicker({ profiles, onPick }: { profiles: Profile[]; onPick: (id: string) => void }) {
  return (
    <div className="center-screen">
      <div className="picker">
        <h1>Who's chatting?</h1>
        <p className="muted">Open a second tab and pick the other person to see both sides.</p>
        <ul>
          {profiles.map((p) => (
            <li key={p.id}>
              <button className="picker-option" onClick={() => onPick(p.id)}>
                <span className="thread-name">{p.displayName}</span>
                <span className="muted">{langName(p.language)}</span>
              </button>
            </li>
          ))}
        </ul>
        {profiles.length === 0 && <p className="notice">No profiles yet. Run supabase/seed.sql.</p>}
      </div>
    </div>
  );
}
