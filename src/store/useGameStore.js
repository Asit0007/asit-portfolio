import { create } from 'zustand'

const ZONES = {
  start: {
    id: 'start',
    label: 'START',
    sublabel: 'Asit Minz · Bangalore',
    color: '#00d4ff',
    content: null,
  },
  cloud: {
    id: 'cloud',
    label: '☁️ Cloud & Infrastructure',
    sublabel: 'Microland · Azure · AWS · Terraform',
    color: '#f59e0b',
    content: {
      title: 'Cloud & Infrastructure Engineer',
      company: 'Microland Limited · Sep 2022–Present',
      points: [
        'Awarded "Super Squad" Certificate by VP Client Delivery Americas (Jan 2025)',
        'Managed hybrid Azure + On-Prem environments for enterprise clients',
        'Provisioned VMs, VNETs, VDI desktops and VMware golden images',
        'Automated patching and health checks via PowerShell & Bash scripts',
        'Certified: Azure Administrator Associate (AZ-104)',
      ],
      tags: ['Azure', 'AWS', 'Terraform', 'VMware', 'PowerShell', 'Linux'],
    },
  },
  projects: {
    id: 'projects',
    label: '🛠️ Projects',
    sublabel: 'CloudPulse · QuantBot · Magento',
    color: '#10b981',
    content: {
      title: 'Personal Projects',
      company: 'Open Source · github.com/Asit0007',
      points: [
        'CloudPulse: Real-time cloud dashboard — Go, AWS ECS Fargate, Terraform, GitHub Actions CI/CD',
        'QuantBot: Automated Trading Bot — Python, OCI, Docker Compose, Cloudflare Tunnel HTTPS',
        'Magento DeployKit: 7 Bash scripts, Varnish/NGINX/PHP-FPM 3-layer caching, DigitalOcean',
      ],
      tags: ['Go', 'Python', 'Docker', 'Terraform', 'GitHub Actions', 'Bash'],
      // Add your actual screenshot filenames here
      slides: [
        { image: '/images/cloudpulse.png',  title: 'CloudPulse',         url: 'https://github.com/Asit0007' },
        { image: '/images/quantbot.png',    title: 'QuantBot',           url: 'https://github.com/Asit0007' },
        { image: '/images/magento.png',     title: 'Magento DeployKit',  url: 'https://github.com/Asit0007' },
      ],
    },
  },
  hobbies: {
    id: 'hobbies',
    label: '🥊 Easter Egg Zone',
    sublabel: 'Beyond the terminal...',
    color: '#a855f7',
    content: {
      title: 'Life Beyond the Terminal',
      company: 'You found the easter egg! 🎉',
      points: [
        '🥊 Muay Thai practitioner — discipline from the gym carries into debugging',
        '🎮 PS2 nostalgia — where problem-solving instincts were first forged',
        '🏸 Badminton player — fast reflexes on and off the court',
        '📚 In progress: HashiCorp Terraform Associate certification',
      ],
      tags: ['Muay Thai', 'Gaming', 'Badminton', 'Terraform (WIP)'],
    },
  },
  contact: {
    id: 'contact',
    label: '📬 Contact',
    sublabel: 'Let\'s work together',
    color: '#f43f5e',
    content: {
      title: 'Get In Touch',
      company: 'Open to Cloud & DevOps opportunities',
      points: [
        '📧 asitminz007@gmail.com',
        '💼 linkedin.com/in/asitminz',
        '🐙 github.com/Asit0007',
        '📱 +91-7978004721',
        '📍 Bangalore, India',
      ],
      tags: ['Available', 'Cloud Engineer', 'DevOps', 'Open to Relocate'],
    },
  },
}

export { ZONES }

const useGameStore = create((set) => ({
  activeZone:     null,
  setActiveZone:  (zoneId) => set({ activeZone: zoneId ? ZONES[zoneId] : null }),

  gameStarted:    false,
  setGameStarted: (v) => set({ gameStarted: v }),

  musicOn:        true,
  setMusicOn:     (v) => set({ musicOn: v }),

  // Project billboard slide index
  slideIndex:     0,
  setSlideIndex:  (v) => set({ slideIndex: v }),

  isLoaded:       false,
  setIsLoaded:    (v) => set({ isLoaded: v }),

  isMobile: /iPhone|iPad|Android/i.test(navigator.userAgent),

  joystick: {
    forward: false, backward: false,
    left: false, right: false, brake: false,
  },
  setJoystick: (j) => set((s) => ({
    joystick: typeof j === 'function' ? j(s.joystick) : j,
  })),

  vehicleBody:    null,
  setVehicleBody: (b) => set({ vehicleBody: b }),
}))

export default useGameStore