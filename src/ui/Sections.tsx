import { useState } from 'react';
import { experience, profile, toolkit } from '../content/profile';
import { formatPeriod } from '../lib/date';
import type { SectionId } from '../scene/config';

function Stop({ id, index, side = 'left', children }: { id: SectionId; index: number; side?: 'left' | 'right'; children: React.ReactNode }) {
  return (
    <section className={`stop ${side}`} id={id} data-stop={index}>
      <div className="wrap">
        <div className="panel">{children}</div>
      </div>
    </section>
  );
}

function CopyEmail() {
  const [status, setStatus] = useState('');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(profile.email);
      setStatus('Copied');
    } catch {
      setStatus('Copy failed · select the address above');
    }
    window.setTimeout(() => setStatus(''), 1800);
  };
  return (
    <>
      <div className="row">
        <a className="mail" href={`mailto:${profile.email}`}>{profile.email}</a>
        <button className="btn lamp" type="button" onClick={copy}>Copy email</button>
        <a className="btn" href={profile.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>
      </div>
      <p className="copied" role="status">{status}</p>
    </>
  );
}

export function Sections() {
  return (
    <>
      <section className="stop hero" id="intro" data-stop={0}>
        <div className="wrap">
          <div className="panel">
            <p className="where">{profile.name} · {profile.location} · 23:40</p>
            <h1>Late nights, clean architecture.</h1>
            <p className="lede">{profile.title} building scalable web applications and the architecture behind them. This is where the work happens.</p>
            <div className="row">
              <a className="btn lamp" href="#about">Take a look around ↓</a>
              <span className="hint">Tip: click anything on the desk</span>
            </div>
          </div>
        </div>
      </section>

      <Stop id="about" index={1} side="right">
        <p className="where">laptop · ~/whoami</p>
        <h2>Strong foundations. Room to grow.</h2>
        <p>Good frontend work goes beyond the screen. It makes complex applications easier to build, maintain and evolve.</p>
        <p>I work with React, TypeScript, JavaScript and Node.js, focused on frontend architecture, Micro Frontends and performance. I enjoy hard technical problems and improving the workflows teams use to ship reliable software.</p>
      </Stop>

      <Stop id="experience" index={2}>
        <p className="where">monitor · experience.ts</p>
        <h2>A frontend journey.</h2>
        <p>Building web applications since {profile.startedAt.year}, with recent years in the securities industry.</p>
        <ul className="jobs">
          {experience.map((job) => (
            <li key={job.company}>
              <b>{job.company}</b>
              <span className="p">{formatPeriod(job.from, job.to, true)}</span>
              <span className="r">{job.role}{job.detail ? ` · ${job.detail}` : ''}</span>
            </li>
          ))}
        </ul>
      </Stop>

      <Stop id="toolkit" index={3}>
        <p className="where">bookshelf · toolkit</p>
        <h2>The tools behind the work.</h2>
        <div className="shelf-groups">
          {toolkit.map((g) => (
            <div key={g.group}>
              <h3>{g.group}</h3>
              <div className="chips">
                {g.items.map((t) => (
                  <span key={t.name} className={t.core ? 'core' : undefined}>{t.name}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="edu">Education · {profile.education}</p>
      </Stop>

      <Stop id="off-duty" index={4}>
        <p className="where">top shelf · off duty</p>
        <h2>Off duty, I look up.</h2>
        <p>The model on the top shelf is a nod to my other interest: fighter jets, especially twin-engine air-superiority designs. Both worlds reward the same things: tight engineering and systems that hold up under load.</p>
      </Stop>

      <Stop id="contact" index={5}>
        <p className="where">phone · 1 new message</p>
        <h2>Have a complex problem? Let's think it through.</h2>
        <p>I'm interested in engineering roles where I can contribute to both the implementation and the architecture.</p>
        <CopyEmail />
      </Stop>
    </>
  );
}
