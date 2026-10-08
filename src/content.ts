export interface PortfolioLink {
  label: string;
  href: string;
}

export interface PortfolioEntry {
  meta: string;
  title: string;
  text: string;
  link?: PortfolioLink;
}

export interface ContentGroup {
  heading: string;
  paragraphs?: string[];
  entries?: PortfolioEntry[];
  tags?: string[];
  links?: PortfolioLink[];
}

export interface PortfolioStop {
  id: string;
  title: string;
  icon: string;
  number: string;
  x: number;
  z: number;
  lead: string;
  groups: ContentGroup[];
}

export const stops: PortfolioStop[] = [
  {
    id: 'about', title: 'About me', icon: '✦', number: '01', x: -5.6, z: -1.2,
    lead: 'I’m Rudra Vaishnav, a Purdue Computer Engineering student who likes building useful systems and interactive worlds.',
    groups: [
      { heading: 'THE SHORT VERSION', paragraphs: ['My concentration is software engineering, and I expect to graduate in December 2027. I’ve worked across AI workflows, backend services, data pipelines, and Unreal Engine development.', 'Games are a big part of why I care about the way technology feels to use. This little world is one way of bringing that interest into my portfolio.'] },
      { heading: 'LET’S CONNECT', links: [
        { label: 'Email Rudra', href: 'mailto:rudra.vaishnav17@gmail.com' },
        { label: 'GitHub', href: 'https://github.com/Rudravaish' },
        { label: 'LinkedIn', href: 'https://www.linkedin.com/in/rudra-vaishnav/' }
      ] }
    ]
  },
  {
    id: 'experience', title: 'Experience', icon: '▥', number: '02', x: -6.8, z: -5.2,
    lead: 'From document intelligence to multiplayer systems, I like work that has to perform beyond a demo.',
    groups: [
      { heading: 'WHERE I’VE WORKED', entries: [
        { meta: 'MAY – AUG 2026 · GILEAD SCIENCE', title: 'AI Developer Intern', text: 'Built a five-agent, six-stage document workflow that reduced manual review from 30–60 minutes to about 2–3 minutes. Validated it across more than 200 cases.' },
        { meta: 'AUG 2025 – MAY 2026 · BASF CORPORATE PARTNERS PROGRAM', title: 'Software Researcher', text: 'Analyzed 10,000+ agricultural reviews with Python and NLP, built Spark data pipelines, and contributed to CI/CD improvements that cut release time by 30%.' },
        { meta: 'JUN 2025 – MAY 2026 · ESCAPE APP AI', title: 'Unreal Engine Developer Intern', text: 'Developed C++ and Blueprint backend systems designed for 1,000+ concurrent users, tested multiplayer networking, and worked on iOS integration targeting 30 fps.' },
        { meta: 'MAY – SEP 2025 · NARB', title: 'Software Engineering Intern', text: 'Built Node.js and MySQL REST services, connected Notion, Gmail, and Sheets, and worked with Docker and Kubernetes deployment.' }
      ] }
    ]
  },
  {
    id: 'projects', title: 'Projects', icon: '◇', number: '03', x: -3.2, z: -7.1,
    lead: 'A couple of projects where code escaped the screen and met the real world.',
    groups: [
      { heading: 'SELECTED BUILDS', entries: [
        { meta: 'PURDUE SPARK HACKATHON · 2026', title: 'Gesture-Controlled Robotic Vehicle', text: 'Used embedded C on two RP2350 controllers to steer a four-wheel vehicle wirelessly with hand gestures. Added a recovery timeout and containerized telemetry.' },
        { meta: 'MACHINE LEARNING · 2025', title: 'Skin Lesion Classifier', text: 'Trained a CNN on the HAM10000 dataset and paired predictions with ABCDE features to make the model’s reasoning easier to inspect.', link: { label: 'View on Devpost', href: 'https://devpost.com/software/skin-lesion-classifier-k9uaos' } }
      ] }
    ]
  },
  {
    id: 'skills', title: 'Skills', icon: '⌘', number: '04', x: 3.2, z: -7.1,
    lead: 'I work across the stack, from low-level control to AI-powered products.',
    groups: [
      { heading: 'LANGUAGES', tags: ['Python', 'Java', 'JavaScript / TypeScript', 'C / C++', 'SQL', 'HTML / CSS'] },
      { heading: 'AI & DATA', tags: ['PySpark / Spark', 'scikit-learn', 'pandas', 'NumPy', 'NLP', 'CNNs', 'RAG', 'Multi-agent systems'] },
      { heading: 'GAME & PLATFORM', tags: ['Unreal Engine', 'Blueprints', 'Docker', 'Kubernetes', 'CI/CD', 'Git / GitHub', 'AWS Bedrock / SageMaker'] }
    ]
  },
  {
    id: 'ongoing', title: 'What’s next', icon: '◌', number: '05', x: 6.8, z: -5.2,
    lead: 'The work in progress starts right here.',
    groups: [
      { heading: 'CURRENT BUILD', entries: [
        { meta: 'ONGOING · INTERACTIVE WEB', title: 'This portfolio world', text: 'A small explorable space that connects my technical work with my love of games. I’m building it as a living portfolio, with room for new projects as they take shape.' }
      ] }
    ]
  },
  {
    id: 'offduty', title: 'Beyond the code', icon: '✳', number: '06', x: 5.6, z: -1.2,
    lead: 'I love games: the worlds, the systems, and the feeling of discovering what is around the next corner.',
    groups: [
      { heading: 'FREE TIME', paragraphs: ['Exploring games is one of the things that makes me want to create interactive experiences of my own. This portfolio is an invitation to explore one of those ideas.'] }
    ]
  }
];
