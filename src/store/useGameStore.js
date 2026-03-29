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
      links: {
        github: 'https://github.com/Asit0007',
        linkedin: 'https://linkedin.com/in/asitminz',
      },
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
        'CloudPulse: Real-time cloud dashboard — Go API, AWS ECS Fargate, Terraform, GitHub Actions',
        'QuantBot: Automated Trading System — Python, OCI Terraform, Docker Compose, Cloudflare Tunnel',
        'Magento DeployKit: 7 idempotent Bash scripts, Varnish/NGINX/PHP-FPM 3-layer caching',
      ],
      tags: ['Go', 'Python', 'Docker', 'Terraform', 'GitHub Actions', 'Bash'],
      links: {
        github: 'https://github.com/Asit0007',
        linkedin: 'https://linkedin.com/in/asitminz',
      },
    },
  },
  hobbies: {
    id: 'hobbies',
    label: '🥊 Easter Egg Zone',
    sublabel: 'Beyond the terminal...',
    color: '#a855f7',
    content: {
      title: 'Life Beyond the Terminal',
      company: 'Fun Facts — you found the easter egg!',
      points: [
        '🥊 Muay Thai practitioner — discipline from the gym carries into debugging sessions',
        '🎮 PS2 nostalgia — where problem-solving instincts were first forged',
        '🏸 Badminton player — fast reflexes on and off the court',
        '📚 In progress: HashiCorp Terraform Associate certification',
      ],
      tags: ['Muay Thai', 'Gaming', 'Badminton', 'Terraform (WIP)'],
      links: {
        github: 'https://github.com/Asit0007',
        linkedin: 'https://linkedin.com/in/asitminz',
      },
    },
  },
}

export { ZONES }

const useGameStore = create((set) => ({
  activeZone:     null,
  setActiveZone:  (zoneId) => set({ activeZone: zoneId ? ZONES[zoneId] : null }),

  // Game flow
  gameStarted:    false,
  setGameStarted: (v) => set({ gameStarted: v }),

  musicOn:        true,
  setMusicOn:     (v) => set({ musicOn: v }),

  isLoaded:       false,
  setIsLoaded:    (v) => set({ isLoaded: v }),

  isMobile: /iPhone|iPad|Android/i.test(navigator.userAgent),

  joystick: {
    forward: false, backward: false,
    left: false,    right: false,
    brake: false,
  },
  setJoystick: (j) => set((s) => ({
    joystick: typeof j === 'function' ? j(s.joystick) : j,
  })),

  vehicleBody:    null,
  setVehicleBody: (b) => set({ vehicleBody: b }),
}))

export default useGameStore