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
    sublabel: 'CloudPulse · Trading Bot · Magento',
    color: '#10b981',
    content: {
      title: 'Personal Projects',
      company: 'Open Source & Personal Lab',
      points: [
        'CloudPulse: Real-time cloud dashboard — Go API, Docker, Terraform, GitHub Actions CI/CD',
        'Automated Trading System: Python, SQLite, Streamlit, fully containerized with CI/CD',
        'Magento DeployKit: Bash toolkit to bootstrap Linux LEMP stacks (NGINX, PHP 8.3, Redis)',
      ],
      tags: ['Docker', 'GitHub Actions', 'Python', 'Go', 'Bash', 'NGINX'],
    },
  },
  hobbies: {
    id: 'hobbies',
    label: '🥊 Easter Egg Zone',
    sublabel: 'Beyond the terminal...',
    color: '#a855f7',
    content: {
      title: 'Life Beyond the Terminal',
      company: 'Fun Facts',
      points: [
        '🥊 Muay Thai practitioner — discipline from the gym carries into debugging sessions',
        '🎮 PS2 nostalgia — where problem-solving instincts were first forged',
        '🏸 Badminton player — fast reflexes on and off the court',
        '📚 Currently studying: HashiCorp Terraform Associate certification',
      ],
      tags: ['Muay Thai', 'Gaming', 'Badminton', 'Terraform (WIP)'],
    },
  },
}

export { ZONES }

const useGameStore = create((set) => ({
  activeZone:     null,
  setActiveZone:  (zoneId) => set({ activeZone: zoneId ? ZONES[zoneId] : null }),

  isLoaded:       false,
  setIsLoaded:    (val) => set({ isLoaded: val }),

  isMobile:       /iPhone|iPad|Android/i.test(navigator.userAgent),

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