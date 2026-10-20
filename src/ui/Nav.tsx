import { SECTION_IDS } from '../scene/config';

const LABELS: Record<(typeof SECTION_IDS)[number], string> = {
  intro: 'Intro',
  about: 'About',
  experience: 'Experience',
  toolkit: 'Toolkit',
  'off-duty': 'Off duty',
  contact: 'Contact',
};

export function Nav({ active }: { active: number }) {
  return (
    <header className="nav">
      <div className="wrap">
        <a className="brand" href="#intro">nhi<span>@</span>desk</a>
        <nav className="stops" aria-label="Sections">
          {SECTION_IDS.map((id, i) => (
            <a key={id} href={`#${id}`} aria-label={LABELS[id]} aria-current={i === active ? 'true' : undefined} className={i === active ? 'on' : undefined}>
              {String(i).padStart(2, '0')}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
