export interface PortfolioLink {
  label: string;
  href: string;
}

export interface PortfolioEntry {
  meta: string;
  title: string;
  text: string;
  skills?: string[];
  tools?: string[];
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
    lead: 'Hey, I’m Rudra—a Purdue Computer Engineering student who likes turning “what if?” into something you can actually try.',
    groups: [
      { heading: 'A LITTLE ABOUT ME', paragraphs: ['I’m concentrating in software engineering and graduating in December 2027. I’ve worked on AI, backend systems, and Unreal Engine projects, but my favorite part is watching an idea become something people can use or play.', 'I’m curious about how things work, love a good game, and enjoy building worlds of my own. Take a lap around this one, find a project that catches your eye, and say hi.'] },
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
    lead: 'A little healthcare, a little hardware, and a world you can walk through. Here’s what I’ve been building.',
    groups: [
      { heading: 'SELECTED BUILDS', entries: [
        { meta: 'HEALTHCARE · WEB APP', title: 'MediMatch AI', text: 'A medication comparison prototype that brings alternatives, budget, and coverage into one view. Built a Python recommendation workflow with filters and downloadable PDF summaries.', tools: ['Python', 'Streamlit', 'pandas', 'ReportLab'], link: { label: 'View on GitHub', href: 'https://github.com/Rudravaish/MediMatch-AI' } },
        { meta: 'INTERACTIVE WEB · 3D', title: 'This portfolio world', text: 'A portfolio you can walk through, with a custom avatar and six stops to explore. Built the movement, camera, animations, and interactions, then shaped the character in Blender.', tools: ['TypeScript', 'Three.js', 'CSS', 'Vite', 'Blender', 'GitHub Pages'], link: { label: 'Explore the source', href: 'https://github.com/Rudravaish/Rudravaish.github.io' } },
        { meta: 'PURDUE SPARK HACKATHON · 2026', title: 'Gesture-Controlled Robotic Vehicle', text: 'A four-wheel rover steered wirelessly with hand gestures. Wrote embedded C for two RP2350 controllers, with a recovery timeout and containerized telemetry to keep things moving reliably.', tools: ['Embedded C', 'RP2350', 'Docker'] },
        { meta: 'MACHINE LEARNING · 2025', title: 'Skin Lesion Classifier', text: 'Trained a CNN on the HAM10000 dataset and paired predictions with ABCDE features, making the model’s reasoning easier to inspect through a web interface.', tools: ['Python', 'PyTorch', 'Flask', 'OpenCV'], link: { label: 'View on Devpost', href: 'https://devpost.com/software/skin-lesion-classifier-k9uaos' } }
      ] }
    ]
  },
  {
    id: 'skills', title: 'Skills', icon: '⌘', number: '04', x: 3.2, z: -7.1,
    lead: 'I work across the stack, from low-level control to AI-powered products.',
    groups: [
      { heading: 'LANGUAGES', tags: ['Python', 'Java', 'JavaScript / TypeScript', 'Swift', 'C / C++', 'SQL', 'HTML / CSS'] },
      { heading: 'AI & DATA', tags: ['PySpark / Spark', 'scikit-learn', 'pandas', 'NumPy', 'NLP', 'CNNs', 'RAG', 'Multi-agent systems'] },
      { heading: 'GAME & PLATFORM', tags: ['Unreal Engine', 'Blueprints', 'SwiftUI / SceneKit', 'Blender', 'Docker', 'Kubernetes', 'CI/CD', 'Git / GitHub', 'AWS Bedrock / SageMaker'] }
    ]
  },
  {
    id: 'ongoing', title: 'What’s next', icon: '◌', number: '05', x: 6.8, z: -5.2,
    lead: 'The next world I’m building comes with boss fights.',
    groups: [
      { heading: 'CURRENT BUILD', entries: [
        { meta: 'IN DEVELOPMENT · IPHONE, IPAD & MAC', title: 'Shardstrike', text: 'An ad-free 3D action game: collect gems, upgrade your hero, and take on 15 levels of boss fights. I’m refining combat and progression as I work toward an App Store release.', skills: ['Swift', 'SwiftUI', 'SceneKit', '3D collision detection', 'Game-state persistence'], tools: ['Xcode', 'GPT Astra', 'Blender (planned art)'], link: { label: 'Follow the build', href: 'https://github.com/Rudravaish/shardstrike' } }
      ] }
    ]
  },
  {
    id: 'offduty', title: 'Beyond the code', icon: '✳', number: '06', x: 5.6, z: -1.2,
    lead: 'I love games—and the chance to create a whole other world from an idea.',
    groups: [
      { heading: 'WORLDS OF MY OWN', paragraphs: ['Playing makes me want to build: new places to explore, mechanics to try, and little surprises around the corner. I’m learning what I can create when the world gets to follow my rules.'] },
      { heading: 'BEHIND THE STAGE', paragraphs: ['I’m also on a dance team’s production crew as a 3D set designer. I model how the sets should look, helping the team picture the stage and bring the performance’s world to life.'] }
    ]
  }
];
