import { useEffect, useState } from 'react';
import { isSoundOn, onSoundChange, setSound } from '../lib/sound';
import { SECTION_IDS, SECTION_LABELS } from '../scene/config';

function SoundToggle() {
  const [on, setOn] = useState(isSoundOn);
  useEffect(() => onSoundChange(setOn), []);
  return (
    <button type="button" className="sound" aria-pressed={on} aria-label="Ambient sound" data-label={on ? 'Sound on' : 'Sound off'} onClick={() => setSound(!on)}>
      <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
        <path d="M3 7.5h3l4-3.5v12l-4-3.5H3z" fill="currentColor" />
        {on ? (
          <path d="M13 7a4 4 0 0 1 0 6M15.5 4.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        ) : (
          <path d="M13.5 7.5l4 5M17.5 7.5l-4 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}

export function Nav({ active }: { active: number }) {
  return (
    <header className="nav">
      <div className="wrap">
        <a className="brand" href="#intro">nhi<span>@</span>desk</a>
        <nav className="stops" aria-label="Sections">
          {SECTION_IDS.map((id, i) => (
            <a
              key={id}
              href={`#${id}`}
              aria-label={SECTION_LABELS[id]}
              data-label={SECTION_LABELS[id]}
              aria-current={i === active ? 'true' : undefined}
              className={i === active ? 'on' : undefined}
            >
              {String(i).padStart(2, '0')}
            </a>
          ))}
          <SoundToggle />
        </nav>
      </div>
    </header>
  );
}
