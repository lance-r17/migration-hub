import {
  Bot, BarChart3, Database, Webhook, Cloud, Shield,
  Network, Cpu, HardDrive, Server, Code, Globe, Zap, Lock, LineChart,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const CATEGORY_ICONS: { name: string; label: string; icon: LucideIcon }[] = [
  { name: 'brain-circuit', label: 'AI / ML',         icon: Bot },
  { name: 'bar-chart-3',   label: 'BI / Analytics',  icon: BarChart3   },
  { name: 'database',      label: 'Big Data',        icon: Database    },
  { name: 'webhook',       label: 'API',             icon: Webhook     },
  { name: 'cloud',         label: 'Cloud',           icon: Cloud       },
  { name: 'shield',        label: 'Security',        icon: Shield      },
  { name: 'network',       label: 'Network',         icon: Network     },
  { name: 'cpu',           label: 'Compute',         icon: Cpu         },
  { name: 'hard-drive',    label: 'Storage',         icon: HardDrive   },
  { name: 'server',        label: 'Infrastructure',  icon: Server      },
  { name: 'code',          label: 'Development',     icon: Code        },
  { name: 'globe',         label: 'Global',          icon: Globe       },
  { name: 'zap',           label: 'Performance',     icon: Zap         },
  { name: 'lock',          label: 'Compliance',      icon: Lock        },
  { name: 'line-chart',    label: 'Monitoring',      icon: LineChart   },
]

export const CATEGORY_MILESTONE_ICON_MAP: Record<string, LucideIcon> =
  Object.fromEntries(CATEGORY_ICONS.map(c => [c.name, c.icon]))
