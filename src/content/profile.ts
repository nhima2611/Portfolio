/**
 * Single source of truth for portfolio content.
 * Both the DOM sections and the 3D screens (editor, terminal, phone, book spines) read from here.
 */
export const profile = {
  name: 'Mã Nam Nhi',
  title: 'Senior Frontend Engineer',
  location: 'Ho Chi Minh City',
  timeZone: 'Asia/Ho_Chi_Minh',
  email: 'nhima2611@gmail.com',
  linkedin: 'https://www.linkedin.com/in/nhima2611/',
  startedAt: { year: 2021, month: 2 },
  education: 'Industrial University of Ho Chi Minh City',
  focus: ['React · TypeScript · Micro Frontends', 'Architecture · Performance · DX'],
} as const;

export interface Job {
  company: string;
  role: string;
  detail?: string;
  /** YYYY-MM */
  from: string;
  /** YYYY-MM, or null while current */
  to: string | null;
}

export const experience: readonly Job[] = [
  { company: 'Vietcap Securities', role: 'Senior Frontend Developer', from: '2024-09', to: null },
  { company: 'HSC', role: 'Frontend Developer', detail: 'Ho Chi Minh City Securities Corp.', from: '2023-08', to: '2024-09' },
  { company: 'THANGO.Co Vietnam', role: 'Frontend Developer', from: '2021-02', to: '2023-07' },
];

export interface Tool {
  name: string;
  core?: boolean;
  /** Spine colour when shown as a book on the shelf. Omit to keep it off the shelf. */
  spine?: string;
}

export const toolkit: readonly { group: string; items: readonly Tool[] }[] = [
  {
    group: 'Frontend & architecture',
    items: [
      { name: 'React', core: true, spine: '#3b6ea8' },
      { name: 'TypeScript', core: true, spine: '#2f5e8f' },
      { name: 'JavaScript', spine: '#b39a2e' },
      { name: 'Micro Frontend', core: true, spine: '#7a4a8c' },
      { name: 'Webpack', spine: '#4d7aa0' },
      { name: 'Module Federation', core: true, spine: '#a5523f' },
    ],
  },
  {
    group: 'Backend',
    items: [
      { name: 'Node.js', spine: '#4a7a46' },
      { name: 'NestJS', spine: '#9a3c4a' },
      { name: 'Express.js', spine: '#55595f' },
      { name: 'Prisma ORM', spine: '#384a63' },
    ],
  },
  {
    group: 'Data, containers, AI agents',
    items: [
      { name: 'PostgreSQL', spine: '#3e5f86' },
      { name: 'MongoDB' },
      { name: 'MySQL' },
      { name: 'Redis', spine: '#a1443a' },
      { name: 'Docker', spine: '#3a78a8' },
      { name: 'Claude Code' },
      { name: 'Codex' },
    ],
  },
];
