import type { Project, Activity, OverallStats, User, ProjectUsers, ProductCategoryEntry } from '@/types'
import type { AuditLogEntry } from '@/types/audit'
import type { Wave } from '@/types/wave'

export const mockProductCategoryMap: ProductCategoryEntry[] = [
  { product: 'ecs',      category: 'VM' },
  { product: 'rds',      category: 'Database' },
  { product: 'polarDB',  category: 'Database' },
  { product: 'oss',      category: 'Buckets' },
  { product: 'slb',      category: 'Network' },
  { product: 'dns',      category: 'Network' },
  { product: 'sls',      category: 'Other' },
  { product: 'Other',    category: 'Other' },
]

export const mockUsers: User[] = [
  { id: 'u1',  name: 'Sarah Jenkins', email: 'sarah.jenkins@corp.com',    department: 'Finance & Operations', initials: 'SJ' },
  { id: 'u2',  name: 'Dan Brown',     email: 'dan.brown@corp.com',         department: 'Platform Engineering', team: 'Platform Engineering', initials: 'DB' },
  { id: 'u3',  name: 'Alice Johnson', email: 'alice.johnson@corp.com',     department: 'Platform Engineering', team: 'Platform Engineering', initials: 'AJ' },
  { id: 'u4',  name: 'Bob Smith',     email: 'bob.smith@corp.com',         department: 'DevOps',               team: 'DevOps',               initials: 'BS' },
  { id: 'u5',  name: 'Carol White',   email: 'carol.white@corp.com',       department: 'Data Engineering',     team: 'Data Engineering',     initials: 'CW' },
  { id: 'u6',  name: 'Eve Davis',     email: 'eve.davis@company.com',      department: 'IT Operations',        team: 'IT Ops',               initials: 'ED' },
  { id: 'u7',  name: 'Frank Miller',  email: 'frank.miller@company.com',   department: 'Platform Security',    team: 'Platform Security',    initials: 'FM' },
  { id: 'u8',  name: 'Grace Lee',     email: 'grace.lee@corp.com',         department: 'Data Engineering',     team: 'Data Engineering',     initials: 'GL' },
  { id: 'u9',  name: 'Henry Wilson',  email: 'henry.wilson@company.com',   department: 'Network Operations',   team: 'Network Ops',          initials: 'HW' },
  { id: 'u10', name: 'Irene Cho',     email: 'irene.cho@company.com',      department: 'Network Engineering',  team: 'Network Engineering',  initials: 'IC' },
  { id: 'u11', name: 'James Park',    email: 'james.park@corp.com',        department: 'Product Management',   initials: 'JP' },
  { id: 'u12', name: 'Karen Lee',     email: 'karen.lee@corp.com',         department: 'Compliance & Risk',    initials: 'KL' },
  { id: 'u13', name: 'Liam Turner',   email: 'liam.turner@corp.com',       department: 'Cloud Architecture',   initials: 'LT' },
  { id: 'u14', name: 'Monica Shah',   email: 'monica.shah@corp.com',       department: 'Site Reliability',     team: 'SRE',                  initials: 'MS' },
  { id: 'u15', name: 'Nathan Cross',  email: 'nathan.cross@corp.com',      department: 'Application Security', initials: 'NC' },
]

export const mockProjectUsers: ProjectUsers[] = [
  // PRJ-2024-ALPHA — contacts: u1 (BO), u2 (TL), u5 (DBA)
  { projectId: 'PRJ-2024-ALPHA', userIds: ['u1', 'u2', 'u3', 'u4', 'u5'] },
  // M-11029 — contacts: u6 (BO), u7 (TL / DBA)
  { projectId: 'M-11029', userIds: ['u6', 'u7', 'u8', 'u9'] },
  // M-77122 — contacts: u12 (BO), u10 (TL)
  { projectId: 'M-77122', userIds: ['u9', 'u10', 'u11', 'u12'] },
]

export const overallStats: OverallStats = {
  progress: 68,
  totalAssets: 1402,
  targetCloud: 'Multi-Region',
  completed: 24,
  inProgress: 12,
}

export const recentActivity: Activity[] = [
  {
    id: '1',
    type: 'success',
    message: 'Core Banking Database migrated successfully',
    time: '2 hours ago',
    actor: 'David Chen',
    projectId: 'PRJ-2024-ALPHA',
  },
  {
    id: '2',
    type: 'info',
    message: 'New Phase started for "Project Nebula"',
    time: '5 hours ago',
    actor: 'Migration Engine',
    projectId: 'M-11029',
  },
  {
    id: '3',
    type: 'error',
    message: 'Security scan failed on Elastic IP endpoint',
    time: 'Yesterday',
    actor: 'System Alert',
    projectId: 'M-77122',
  },
]

export const mockProjects: Project[] = [
  {
    id: 'PRJ-2024-ALPHA',
    name: 'Alpha Core ERP Migration',
    status: 'in-progress',
    progress: 45,
    description: 'Modernizing the legacy SAP environment to Azure Cloud Infrastructure with Zero-Downtime goals.',
    migrationWave: 'Wave 3',
    waveId: 'wave-1',
    jiraBaseUrl: 'https://your-org.atlassian.net',
    profileOwner: 'Dan Brown, Platform Engineering',
    lastUpdated: '21 MAR 2026',
    team: [
      { id: 't1', name: 'Alice Johnson', initials: 'AJ' },
      { id: 't2', name: 'Bob Smith', initials: 'BS' },
      { id: 't3', name: 'Carol White', initials: 'CW' },
      { id: 't4', name: 'Dan Brown', initials: 'DB' },
    ],
    approvals: [
      { id: 'a1', role: 'Technical Lead', approver: 'Dan Brown', status: 'approved', timestamp: 'Oct 24, 09:12 AM', icon: 'Wrench', userId: 'u2' },
      { id: 'a2', role: 'Business Owner', approver: 'Sarah Jenkins', status: 'approved', timestamp: 'Mar 22, 02:30 PM', icon: 'CreditCard', userId: 'u1' },
      { id: 'a3', role: 'Platform Migration Lead', status: 'pending', icon: 'CloudCheck', userId: 'u-current' },
    ],

    // Section 1
    applicationOverview: {
      applicationName: 'Alpha Core ERP',
      shortName: 'ALPHA-ERP',
      businessOwnerId: 'u1',
      technicalLeadId: 'u2',
      dbaDataOwnerId: 'u5',
      businessFunction: 'Centralised ERP platform covering procurement, finance, HR, and supply chain for ~2,400 internal users. Mission-critical for daily financial close and regulatory reporting.',
      userBase: { type: 'Internal', count: '~2,400 users' },
      applicationTier: 'P1',
      eimId: 'EIM-00421',
      ibsInScope: true,
      migrationStrategy: 'Lift & Shift',
    },

    // Section 2
    currentInfrastructure: {
      resources: [
        {
          id: 'res1', resourceId: 'i-0a1b2c3d4e', name: 'ERP App Server', product: 'ecs',
          resourceSet: 'corp-00421-alpha-erp-prod',
          specs: { instance_type: 'ecs.c6.xlarge', cpu: 4, memory: 16 },
          subApplication: 'erp-core',
          targetResourceId: 'tgt-placeholder', syncStatus: 'out-of-sync',
        },
        {
          id: 'res2', resourceId: 'rm-0b2c3d4e5f', name: 'Primary Oracle DB', product: 'rds',
          resourceSet: 'corp-00421-alpha-erp-prod',
          specs: { instance_type: 'rds.mssql.s2.large', cpu: 8, memory: 64, storage_gb: 2000 },
          subApplication: 'erp-core',
          targetResourceId: 'tgt-placeholder', syncStatus: 'out-of-sync',
        },
        {
          id: 'res3', resourceId: 'r-0c3d4e5f6a', name: 'Redis Session Cache', product: 'ecs',
          resourceSet: 'corp-00421-alpha-erp-prod',
          specs: { instance_type: 'ecs.c6.large', cpu: 2, memory: 8 },
          targetResourceId: 'tgt-placeholder', syncStatus: 'provisioning',
          needMigration: false,
        },
        {
          id: 'res4', resourceId: 'oss-0d4e5f6a7b', name: 'Static Assets Bucket', product: 'oss',
          resourceSet: 'corp-00421-alpha-erp-prod',
          specs: { capacity_tb: 2, iops: 3000, backup: 'daily' },
          targetResourceId: 'tgt-placeholder', syncStatus: 'out-of-sync',
        },
        // — VMs —
        {
          id: 'res-a5', resourceId: 'i-0e5f6a7b8c', name: 'SAP ABAP Application Server', product: 'ecs',
          resourceSet: 'corp-00421-alpha-erp-prod',
          specs: { instance_type: 'ecs.c6.2xlarge', cpu: 8, memory: 32 },
          subApplication: 'erp-core',
          targetResourceId: 'tgt-placeholder', syncStatus: 'out-of-sync',
        },
        {
          id: 'res-a6', resourceId: 'i-0f6a7b8c9d', name: 'SAP Web Dispatcher', product: 'slb',
          resourceSet: 'corp-00421-alpha-erp-prod',
          specs: { instance_type: 'ecs.c6.large', cpu: 2, memory: 8 },
          targetResourceId: 'tgt-placeholder', syncStatus: 'provisioning',
        },
        {
          id: 'res-a7', resourceId: 'i-1a7b8c9d0e', name: 'HR Module App Server', product: 'ecs',
          resourceSet: 'corp-00421-alpha-erp-dev',
          specs: { instance_type: 'ecs.c6.xlarge', cpu: 4, memory: 16 },
          subApplication: 'erp-hr',
          targetResourceId: 'tgt-placeholder', syncStatus: 'out-of-sync',
        },
        {
          id: 'res-a8', resourceId: 'i-2b8c9d0e1f', name: 'Finance Module App Server', product: 'ecs',
          resourceSet: 'corp-00421-alpha-erp-prod',
          specs: { instance_type: 'ecs.c6.xlarge', cpu: 4, memory: 16 },
          subApplication: 'erp-finance',
          targetResourceId: 'tgt-placeholder', syncStatus: 'out-of-sync',
        },
        {
          id: 'res-a9', resourceId: 'i-3c9d0e1f2a', name: 'Supply Chain API Server', product: 'ecs',
          resourceSet: 'corp-00421-alpha-erp-prod',
          specs: { instance_type: 'ecs.c6.xlarge', cpu: 4, memory: 8 },
          subApplication: 'erp-supply-chain',
          targetResourceId: 'tgt-placeholder', syncStatus: 'provisioning',
        },
        {
          id: 'res-a10', resourceId: 'i-4d0e1f2a3b', name: 'Batch Processing Server', product: 'ecs',
          resourceSet: 'corp-00421-alpha-erp-prod',
          specs: { instance_type: 'ecs.c6.2xlarge', cpu: 8, memory: 32 },
          targetResourceId: 'tgt-placeholder', syncStatus: 'out-of-sync',
        },
        {
          id: 'res-a11', resourceId: 'i-5e1f2a3b4c', name: 'SFTP File Transfer Server', product: 'ecs',
          resourceSet: 'corp-00421-alpha-erp-dev',
          specs: { instance_type: 'ecs.c6.large', cpu: 2, memory: 4 },
          targetResourceId: 'tgt-placeholder', syncStatus: 'provisioning',
          needMigration: false,
        },
        // — Databases —
        {
          id: 'res-a12', resourceId: 'rm-6f2a3b4c5d', name: 'Oracle DB Read Replica', product: 'rds',
          resourceSet: 'corp-00421-alpha-erp-prod',
          specs: { instance_type: 'rds.mssql.s2.large', cpu: 8, memory: 64 },
          targetResourceId: 'tgt-placeholder', syncStatus: 'out-of-sync',
        },
        {
          id: 'res-a13', resourceId: 'rm-7a3b4c5d6e', name: 'Reporting Analytics DB', product: 'polarDB',
          resourceSet: 'corp-00421-alpha-erp-prod',
          specs: { instance_type: 'polar.mysql.x4.large', cpu: 16, memory: 128, storage_gb: 10240 },
          targetResourceId: 'tgt-placeholder', syncStatus: 'provisioning',
        },
        {
          id: 'res-a14', resourceId: 'rm-8b4c5d6e7f', name: 'Audit Trail Database', product: 'rds',
          resourceSet: 'corp-00421-alpha-erp-prod',
          specs: { instance_type: 'rds.mysql.s3.large', cpu: 4, memory: 16, storage_gb: 2048 },
          targetResourceId: 'tgt-placeholder', syncStatus: 'out-of-sync',
        },
        {
          id: 'res-a15', resourceId: 'rm-9c5d6e7f8a', name: 'Oracle RAC Node 3', product: 'rds',
          resourceSet: 'corp-00421-alpha-erp-prod',
          specs: { instance_type: 'rds.mssql.s2.large', cpu: 8, memory: 64 },
          targetResourceId: 'tgt-placeholder', syncStatus: 'provisioning',
        },
        // — Buckets —
        {
          id: 'res-a16', resourceId: 'oss-0d6e7f8a9b', name: 'Document Archive Store', product: 'oss',
          resourceSet: 'corp-00421-alpha-erp-prod',
          specs: { capacity_gb: 800, redundancy: 'geo', lifecycle: 'daily' },
          targetResourceId: 'tgt-placeholder', syncStatus: 'provisioning',
        },
        {
          id: 'res-a17', resourceId: 'oss-1e7f8a9b0c', name: 'Backup Vault (Cold)', product: 'oss',
          resourceSet: 'corp-00421-alpha-erp-prod',
          specs: { capacity_tb: 12, tier: 'archive', retention_years: 7 },
          targetResourceId: 'tgt-placeholder', syncStatus: 'out-of-sync',
        },
        {
          id: 'res-a18', resourceId: 'oss-2f8a9b0c1d', name: 'SAP Media Library Bucket', product: 'oss',
          resourceSet: 'corp-00421-alpha-erp-prod',
          specs: { capacity_gb: 500, tier: 'standard' },
          targetResourceId: 'tgt-placeholder', syncStatus: 'out-of-sync',
        },
        // — Network —
        {
          id: 'res-a19', resourceId: 'slb-3a9b0c1d2e', name: 'F5 BIG-IP Load Balancer', product: 'slb',
          resourceSet: 'corp-00421-alpha-erp-prod',
          specs: { mode: 'active-passive', throughput_gbps: 10 },
          targetResourceId: 'tgt-placeholder', syncStatus: 'out-of-sync',
        },
        {
          id: 'res-a20', resourceId: 'fw-4b0c1d2e3f', name: 'Perimeter Firewall Cluster', product: 'Other',
          resourceSet: 'corp-00421-alpha-erp-prod',
          specs: { mode: 'ha-pair', throughput_gbps: 40 },
          targetResourceId: 'tgt-placeholder', syncStatus: 'provisioning',
        },
        {
          id: 'res-a21', resourceId: 'waf-5c1d2e3f4a', name: 'Internal WAF Appliance', product: 'Other',
          resourceSet: 'corp-00421-alpha-erp-prod',
          specs: { ruleset: 'OWASP', ssl_inspection_gbps: 5 },
          targetResourceId: 'tgt-placeholder', syncStatus: 'provisioning',
        },
        {
          id: 'res-a22', resourceId: 'rt-6d2e3f4a5b', name: 'MPLS Gateway Router', product: 'dns',
          resourceSet: 'corp-00421-alpha-erp-prod',
          specs: { circuit_gbps: 10, protocol: 'BGP' },
          targetResourceId: 'tgt-placeholder', syncStatus: 'out-of-sync',
        },
        // — Other —
        {
          id: 'res-a23', resourceId: 'mq-7e3f4a5b6c', name: 'ActiveMQ Message Broker', product: 'sls',
          resourceSet: 'corp-00421-alpha-erp-prod',
          specs: { instance_type: 'ecs.c6.xlarge', cpu: 4, memory: 8, mode: 'master-slave-ha' },
          targetResourceId: 'tgt-placeholder', syncStatus: 'provisioning',
        },
      ],
      network: {
        loadBalancerType: 'L7 — F5 BIG-IP (Active/Passive)',
        vipDnsNames: ['erp.corp.com', 'erp-api.corp.com', '10.20.1.50 (VIP)'],
        firewallZones: ['DMZ → App tier', 'App tier → DB tier', 'DB tier → Backup zone'],
        bandwidthRequirements: 'Peak 1.2 Gbps ingress, 400 Mbps egress',
        hardcodedIps: true,
        privateConnectivity: 'MPLS dedicated link to legacy mainframe (10 Gbps); must be replicated in target environment.',
      },
    },

    // Section 3
    availability: {
      rto: '4 hours',
      rpo: '1 hour',
      availabilitySla: '99.99%',
      currentAzPattern: 'Active-Passive — AZ-A primary, AZ-B standby',
      azAwareToday: false,
      azFailureBehaviour: 'Manual failover required. On AZ-A failure, DBA team promotes AZ-B replica and ops team updates DNS VIP. Estimated manual recovery: 45–90 min.',
      azReadiness3Az: 'Oracle RAC quorum is configured for 2 nodes only. Adding a third AZ requires re-architecting quorum to 3-node before migration. Redis Sentinel also assumes 2 nodes.',
      healthCheckEndpoints: ['/health', '/api/status', '/actuator/health'],
      currentTopologyDescription: 'AZ-A: 2× App servers (active), Oracle DB primary, Redis master, F5 active LB.\nAZ-B: 2× App servers (standby), Oracle DB replica (async), Redis replica, F5 passive LB.',
    },

    // Section 4
    dataPersistence: {
      databaseTypes: ['Oracle DB 19c', 'Redis 7'],
      totalDataVolume: '~4.2 TB across all databases',
      dataGrowthRate: '+50 GB / month',
      replicationTopology: 'Oracle Data Guard — async replication, AZ-A primary → AZ-B replica. Redis Sentinel with 1 master + 1 replica.',
      backupMethod: 'Oracle RMAN daily full + hourly incremental; stored in AZ-B and offsite tape. Redis AOF + RDB snapshots hourly.',
      backupRequiredDuringMigration: true,
      lastRestoreTest: 'https://brett.corp.com/tests/erp-restore-2026-02-14',
      dataResidency: 'All data must remain within EU-West region. GDPR data subject rights procedures in place.',
      encryptionAtRest: 'AES-256 via Oracle TDE. Redis encrypted at OS level (LUKS). Keys managed by CyberArk.',
      piiData: true,
      statefulComponents: ['Oracle DB 19c (primary + replica)', 'Redis 7 session store', 'Shared NFS file store (legacy attachments, 800 GB)'],
    },

    // Section 5
    dependencies: {
      upstream: [
        { id: 'd1', name: 'Auth Service', eimId: 'EIM-00105', contactEmail: 'identity-team@corp.com', hosting: 'On-Premise', notes: 'SAML 2.0 SSO provider' },
        { id: 'd2', name: 'Payment Gateway', eimId: 'EIM-00212', contactEmail: 'vendor-support@payments.com', hosting: 'AliCloud', notes: 'IP allowlist change required post-migration' },
        { id: 'd3', name: 'User Directory (LDAP)', eimId: 'EIM-00089', contactEmail: 'it-ops@corp.com', hosting: 'On-Premise', notes: 'TLS LDAP — server cert tied to current hostname' },
      ],
      downstream: [
        { id: 'd4', name: 'Invoicing Service', eimId: 'EIM-00317', contactEmail: 'finance-eng@corp.com', hosting: 'AliCloud', notes: '' },
        { id: 'd5', name: 'BI Reporting Platform', eimId: 'EIM-00428', contactEmail: 'analytics@corp.com', hosting: 'On-Premise', notes: 'Direct DB connection — hardcoded DB host IP in config' },
        { id: 'd6', name: 'Audit Log Aggregator', eimId: 'EIM-00531', contactEmail: 'security-ops@corp.com', hosting: 'AliCloud', notes: '' },
      ],
      certificatesSecrets: {
        tlsCertificates: 'erp.corp.com: issued by Internal CA, expires 2026-09-15 (6 months post-migration — flag for renewal). erp-api.corp.com: expires 2026-11-01.',
        secretsManagement: 'CyberArk — all DB credentials, API keys, and service account passwords managed centrally. Application fetches at startup via CyberArk SDK.',
        apiKeys: 'Payment Gateway API key is IP-restricted to current AZ-A egress IP (10.20.1.10). Must be updated with new egress IP post-migration.',
      },
    },

    // Section 6
    nfrs: {
      peakLoad: '15,000 TPS, 50k concurrent users; Peak 10:00 AM – 2:00 PM EST.',
      autoscaling: 'Horizontal Pod Autoscaling (HPA) via K8s based on CPU/RAM.',
      seasonalPatterns: 'Black Friday spikes; Freeze window: Nov 15 – Dec 15.',
      latencySensitivity: 'Sub-5ms core banking API; AZ round-trip sensitive.',
      monitoring: 'Datadog & Prometheus; Alerting tied to static IPs — must be reconfigured.',
      logAggregation: 'Splunk; forwarders need new subnet reconfiguration post-migration.',
      compliance: ['SOC2', 'GDPR', 'PCI-DSS L1'],
      licensing: 'Oracle DB per-socket; new instance type requires licensing reassessment with Oracle CSM.',
    },

    // Section 7
    migrationConstraints: {
      migrationWindow: 'Saturday 02:00–06:00 AM EST',
      blackoutDates: [
        { name: 'Q4 Year-end', from: '2024-12-20', to: '2025-01-05' },
        { name: 'Audit window', from: '2024-10-15', to: '2024-10-30' },
      ],
      changeFreezePeriods: [
        { name: 'Org-wide change freeze', from: '2024-12-01', to: '2024-12-19' },
        { name: 'PCI audit prep', from: '2024-09-15', to: '2024-09-30' },
      ],
      maxCutoverWindow: '4 hours',
      cutoverApproach: 'Blue-Green deployment with Canary release strategy (10% traffic shift, then full cut).',
      rollbackPlan: 'DNS VIP switch-back to legacy on-prem F5. Estimated rollback time: 15 minutes. Runbook: Confluence/RUNBOOK-ERP-001.',
      stakeholderComms: 'Notify: Ops, Customer Support, Finance Leadership, DBA Team. Lead time: 5 business days minimum.',
      preMigrationTesting: 'Full UAT environment validation, Security/Compliance sign-off, performance baseline comparison, and DBA-approved DB restore test required before cutover approval.',
    },

    // Section 8
    targetArchitecture: {
      summary: 'Implementing Hub-and-Spoke topology with Azure VNet Peering. All traffic routed through NVA for security inspection.',
      constraints: '- Must maintain connectivity to mainframe during 3-day cutover window.\n- No data can leave the EU-West region.',
      reArchitectureNeeded: true,
      topology3Az: 'AZ-1: 2× App active, Oracle primary. AZ-2: 2× App active, Oracle replica. AZ-3: App standby, Oracle replica (3-node RAC). Traffic balanced across AZ-1 and AZ-2 via Azure Application Gateway.',
      replicationChanges: 'Oracle RAC must be extended from 2-node to 3-node quorum before migration. Redis Sentinel upgraded to 3-node cluster (1 master, 2 replicas). Estimated effort: 3 weeks (DBA team).',
      dnsIpChanges: 'erp.corp.com and erp-api.corp.com will point to new Azure Application Gateway IPs. All downstream consumers using hardcoded IPs (BI platform) must update config.',
      newServicesRequired: ['Azure Application Gateway (L7 LB)', 'Azure Private DNS Zone', 'Azure Key Vault (replace on-prem CyberArk dependency)', 'Azure Monitor + Log Analytics workspace'],
      architectureDiagram: 'https://confluence.corp.com/display/ARCH/ERP-3AZ-Target-Architecture',
    },

    // Section 9
    risks: [
      {
        id: 'r1',
        title: 'Latency issues in DR region',
        description: 'App servers in East-US are exceeding 50ms to DB — AZ round-trip sensitivity may cause SLA breach in 3AZ config.',
        severity: 'critical',
        mitigation: 'Network topology review scheduled with NetEng. Evaluate proximity placement groups in target AZs.',
        owner: 'Dan Brown',
        riskStatus: 'open',
      },
      {
        id: 'r2',
        title: 'SSL Certificate Expiry',
        description: 'Certs for dev environment expire in 14 days. Prod cert (erp.corp.com) expires 6 months post-migration — borderline.',
        severity: 'medium',
        mitigation: 'Renew dev certs immediately. Schedule prod cert renewal as part of migration prep. Confirm Internal CA lead time.',
        owner: 'Alice Johnson',
        riskStatus: 'resolved',
      },
    ],
  },
  {
    id: 'M-11029',
    name: 'User Auth Legacy',
    status: 'signed-off',
    progress: 100,
    description: 'Completed migration of the legacy Node.js OAuth2/JWT authentication service to an AZ-resilient ECS Fargate deployment with Multi-AZ RDS.',
    migrationWave: 'Wave 1',
    waveId: 'wave-3',
    profileOwner: 'Frank Miller, Platform Security',
    jiraTicket: 'JIRA-1829',
    jiraBaseUrl: 'https://your-org.atlassian.net',
    lastUpdated: '25 OCT 2025',
    team: [
      { id: 't5', name: 'Eve Davis', initials: 'ED' },
      { id: 't6', name: 'Frank Miller', initials: 'FM' },
    ],
    approvals: [
      { id: 'a4', role: 'Technical Lead', approver: 'Frank Miller', status: 'approved', timestamp: 'Oct 24, 09:12 AM', icon: 'Wrench', userId: 'u7' },
      { id: 'a5', role: 'Business Owner', approver: 'Eve Davis', status: 'approved', timestamp: 'Oct 24, 14:30 PM', icon: 'CreditCard', userId: 'u6' },
      { id: 'a6', role: 'Platform Migration Lead', approver: 'R. Kim', status: 'approved', timestamp: 'Oct 25, 10:00 AM', icon: 'CloudCheck', userId: 'u-current' },
    ],

    applicationOverview: {
      applicationName: 'User Auth Legacy',
      shortName: 'auth-svc',
      applicationTier: 'P3',
      eimId: 'EIM-0042',
      userBase: { type: 'Internal', count: '~800 employees' },
      businessFunction: 'Centralised OAuth2 / JWT authentication and session management for internal tooling.',
      businessOwnerId: 'u6',
      technicalLeadId: 'u7',
      dbaDataOwnerId: 'u8',
      ibsInScope: false,
      migrationStrategy: 'Lift & Shift',
    },

    currentInfrastructure: {
      resources: [
        {
          id: 'res5', resourceId: 'i-aa1b2c3d', name: 'auth-svc App Server', product: 'ecs',
          resourceSet: 'corp-00203-auth-svc-prod',
          specs: { instance_type: 'ecs.c6.large', cpu: 2, memory: 4 },
          targetResourceId: 'tgt-placeholder', syncStatus: 'synced',
        },
        {
          id: 'res6', resourceId: 'rm-bb2c3d4e', name: 'PostgreSQL 14 Session Store', product: 'rds',
          resourceSet: 'corp-00203-auth-svc-prod',
          specs: { instance_type: 'rds.pg.t3.medium', storage_gb: 100 },
          targetResourceId: 'tgt-placeholder', syncStatus: 'synced',
        },
        {
          id: 'res-m11-3', resourceId: 'i-cc3d4e5f', name: 'OAuth Token Cache', product: 'ecs',
          resourceSet: 'corp-00203-auth-svc-prod',
          specs: { instance_type: 'ecs.c6.large', cpu: 2, memory: 4 },
          targetResourceId: 'tgt-placeholder', syncStatus: 'out-of-sync',
        },
        {
          id: 'res-m11-4', resourceId: 'oss-dd4e5f6a', name: 'Auth Audit Log Store', product: 'oss',
          resourceSet: 'corp-00203-auth-svc-prod',
          specs: { capacity_gb: 200, tier: 'standard', retention_years: 3 },
          targetResourceId: 'tgt-placeholder', syncStatus: 'provisioning',
        },
        {
          id: 'res-m11-5', resourceId: 'rm-ee5f6a7b', name: 'Identity Provider DB', product: 'rds',
          resourceSet: 'corp-00203-auth-svc-prod',
          specs: { instance_type: 'rds.pg.t3.large', storage_gb: 250 },
          targetResourceId: 'tgt-placeholder', syncStatus: 'out-of-sync',
        },
        {
          id: 'res-m11-6', resourceId: 'slb-ff6a7b8c', name: 'Auth API Gateway', product: 'slb',
          resourceSet: 'corp-00203-auth-svc-prod',
          specs: { type: 'internal-nlb', throughput_gbps: 1 },
          targetResourceId: 'tgt-placeholder', syncStatus: 'synced',
        },
      ],
      network: {
        loadBalancerType: 'Internal ALB',
        hardcodedIps: false,
        bandwidthRequirements: '< 100 Mbps',
      },
    },

    availability: {
      rto: '2 hours',
      rpo: '30 minutes',
      availabilitySla: '99.5%',
      currentAzPattern: 'Single-AZ (AZ-A)',
      azAwareToday: false,
      azFailureBehaviour: 'Full service outage on AZ failure. Failover handled by redeployment.',
      azReadiness3Az: 'Stateless app layer is 3AZ-ready. Session DB requires replication changes.',
      currentTopologyDescription: 'Single Node.js instance behind an internal ALB. PostgreSQL on a single RDS instance in AZ-A.',
    },

    dataPersistence: {
      databaseTypes: ['PostgreSQL 14'],
      totalDataVolume: '12 GB',
      dataGrowthRate: '~500 MB/month',
      replicationTopology: 'Single primary, no replicas (pre-migration)',
      backupMethod: 'RDS automated snapshots to S3 — 7-day retention',
      backupRequiredDuringMigration: false,
      lastRestoreTest: 'https://brett.corp.com/tests/auth-svc-restore-2025-09-10',
      dataResidency: 'Region: ap-southeast-1',
      encryptionAtRest: 'AES-256 via AWS KMS',
      piiData: true,
      statefulComponents: ['PostgreSQL session store'],
    },

    dependencies: {
      upstream: [
        { id: 'd10', name: 'Corporate LDAP', eimId: 'EIM-00089', contactEmail: 'it-ops@corp.com', hosting: 'On-Premise', notes: 'Directory bind for employee authentication' },
      ],
      downstream: [
        { id: 'd11', name: 'Internal Dev Portal', eimId: 'EIM-00307', contactEmail: 'platform@company.com', hosting: 'AliCloud', notes: '' },
        { id: 'd12', name: 'CI/CD Pipeline', eimId: 'EIM-00412', contactEmail: 'devops@company.com', hosting: 'AliCloud', notes: 'Service account tokens issued by auth-svc' },
      ],
      certificatesSecrets: {
        tlsCertificates: 'Wildcard cert *.company.com — renewed Feb 2026',
        secretsManagement: 'AWS Secrets Manager',
        apiKeys: 'JWT signing keys rotated quarterly via Secrets Manager',
      },
    },

    nfrs: {
      peakLoad: '~120 req/s during business hours',
      autoscaling: 'Not configured — single instance pre-migration; ECS service auto-scaling enabled post-migration.',
      seasonalPatterns: 'Low variance. Slight spike during onboarding cycles (Jan, Sep).',
      latencySensitivity: '< 200ms p99 for token validation',
      monitoring: 'CloudWatch metrics + Datadog APM',
      logAggregation: 'CloudWatch Logs → Splunk',
      compliance: ['ISO 27001', 'SOC 2'],
      licensing: 'Node.js OSS — no licensing concerns',
    },

    migrationConstraints: {
      migrationWindow: 'Saturdays 02:00–06:00 AEST',
      maxCutoverWindow: '2 hours',
      blackoutDates: [
        { name: 'Christmas', from: '2025-12-25' },
        { name: "New Year's Day", from: '2026-01-01' },
      ],
      cutoverApproach: 'Blue-green deployment with DNS flip. Old environment kept warm for 48h post-cutover.',
      rollbackPlan: 'DNS revert to blue environment within 10 minutes.',
      stakeholderComms: 'IT Ops notified 48h in advance. Maintenance window posted on internal status page.',
      preMigrationTesting: 'Load test at 150% peak traffic on staging. JWT validation latency verified < 200ms.',
    },

    targetArchitecture: {
      summary: 'Deployed auth-svc across 3 AZs via ECS Fargate. RDS PostgreSQL promoted to Multi-AZ. JWT signing key management migrated to AWS Secrets Manager with automatic rotation.',
      constraints: 'Must maintain backwards compatibility with existing OAuth2 token format. No client-side changes permitted.',
      reArchitectureNeeded: false,
      topology3Az: 'ECS Fargate service with tasks distributed across AZ-A, AZ-B, AZ-C behind an internal ALB.',
      replicationChanges: 'RDS promoted to Multi-AZ standby replica in AZ-B.',
      dnsIpChanges: 'auth.internal.company.com updated to new ALB DNS name.',
    },

    risks: [],
  },
  {
    id: 'M-88271',
    name: 'Data Warehouse Sync',
    status: 'planning',
    progress: 12,
    jiraBaseUrl: 'https://your-org.atlassian.net',
    team: [
      { id: 't7', name: 'Grace Lee', initials: 'GL' },
    ],
    approvals: [
      { id: 'a7', role: 'Technical Lead', status: 'pending', icon: 'Wrench' },
      { id: 'a8', role: 'Business Owner', status: 'pending', icon: 'CreditCard' },
      { id: 'a9', role: 'Platform Migration Lead', status: 'pending', icon: 'CloudCheck', userId: 'u-current' },
    ],
    risks: [],
  },
  {
    id: 'M-77122',
    name: 'Global Edge DNS',
    status: 'blocked',
    progress: 88,
    description: 'Large-scale DNS infrastructure migration from on-prem BIND clusters to AWS Route 53 with Anycast edge. APAC and US regions live; EU cutover blocked on propagation TTL issue.',
    migrationWave: 'Wave 2',
    waveId: 'wave-1',
    jiraBaseUrl: 'https://your-org.atlassian.net',
    profileOwner: 'Henry Wilson, Network Operations',
    lastUpdated: '20 MAR 2026',
    team: [
      { id: 't8', name: 'Henry Wilson', initials: 'HW' },
      { id: 't9', name: 'Irene Cho', initials: 'IC' },
    ],
    approvals: [
      { id: 'a10', role: 'Technical Lead', approver: 'Irene Cho', status: 'approved', timestamp: 'Oct 20, 11:00 AM', icon: 'Wrench', userId: 'u10' },
      { id: 'a11', role: 'Business Owner', status: 'waiting', icon: 'CreditCard', userId: 'u12' },
      { id: 'a12', role: 'Platform Migration Lead', status: 'pending', icon: 'CloudCheck', userId: 'u-current' },
    ],

    applicationOverview: {
      applicationName: 'Global Edge DNS',
      shortName: 'edge-dns',
      applicationTier: 'P1',
      eimId: 'EIM-0088',
      userBase: { type: 'External', count: '~4M end users globally' },
      businessFunction: 'Authoritative DNS resolution for all public-facing services across APAC, EU, and US regions.',
      businessOwnerId: 'u12',
      technicalLeadId: 'u10',
      ibsInScope: true,
      migrationStrategy: 'Refactor',
    },

    currentInfrastructure: {
      resources: [
        {
          id: 'res7', resourceId: 'i-aa7b8c9d', name: 'DNS Primary Cluster (APAC)', product: 'ecs',
          resourceSet: 'corp-0088-edge-dns-prod',
          specs: { instance_type: 'ecs.c6.2xlarge', cpu: 8, memory: 32 },
          targetResourceId: 'tgt-placeholder', syncStatus: 'out-of-sync',
        },
        {
          id: 'res8', resourceId: 'i-bb8c9d0e', name: 'DNS Secondary Cluster (EU)', product: 'ecs',
          resourceSet: 'corp-0088-edge-dns-prod',
          specs: { instance_type: 'ecs.c6.2xlarge', cpu: 8, memory: 32 },
          targetResourceId: 'tgt-placeholder', syncStatus: 'out-of-sync',
        },
        {
          id: 'res9', resourceId: 'i-cc9d0e1f', name: 'Anycast Edge Nodes ×12', product: 'dns',
          resourceSet: 'corp-0088-edge-dns-prod',
          specs: { instance_type: 'ecs.c6.xlarge', cpu: 4, memory: 8, nodes: 12 },
          targetResourceId: 'tgt-placeholder', syncStatus: 'provisioning',
        },
      ],
      network: {
        loadBalancerType: 'Anycast routing',
        bandwidthRequirements: '~2 Gbps peak DNS query traffic',
        hardcodedIps: true,
        privateConnectivity: 'Dedicated interconnects to upstream registrars (Level3, Akamai)',
        vipDnsNames: ['dns1.company.com', 'dns2.company.com', 'ns1.edge.company.com'],
        firewallZones: ['DMZ-EXTERNAL', 'DNS-MANAGEMENT'],
      },
    },

    availability: {
      rto: '15 minutes',
      rpo: '0 (stateless)',
      availabilitySla: '99.999%',
      currentAzPattern: 'Active-Active across 3 AZs per region',
      azAwareToday: true,
      azFailureBehaviour: 'Anycast routing automatically bypasses failed AZ. Query traffic rerouted within < 5 seconds.',
      azReadiness3Az: 'Fully 3AZ-capable in APAC. EU region still migrating secondary cluster.',
      healthCheckEndpoints: ['health.dns1.company.com/status', 'health.dns2.company.com/status'],
      currentTopologyDescription: '12 anycast edge PoPs globally. APAC primary cluster on-prem transitioning to cloud-native Route 53 Resolver. EU secondary cluster still on-prem hardware.',
    },

    dataPersistence: {
      databaseTypes: ['Route 53 Hosted Zones', 'Custom zone DB (PostgreSQL 13)'],
      totalDataVolume: '~800 MB zone data',
      dataGrowthRate: '~5 MB/month',
      replicationTopology: 'Multi-master zone replication across APAC nodes. EU replication lagging — root cause of current blocker.',
      backupMethod: 'Zone file exports to S3 every 6 hours. Route 53 managed zones have no export required.',
      backupRequiredDuringMigration: false,
      lastRestoreTest: 'https://brett.corp.com/tests/edge-dns-restore-2025-11-15',
      dataResidency: 'Zone data replicated across ap-southeast-1, eu-west-1, us-east-1',
      encryptionAtRest: 'N/A — DNS zone data is public',
      piiData: false,
      statefulComponents: ['PostgreSQL zone authority DB', 'DNSSEC key store'],
    },

    dependencies: {
      upstream: [
        { id: 'd13', name: 'Domain Registrar API', eimId: 'EIM-00601', contactEmail: 'network-ops@corp.com', hosting: 'On-Premise', notes: 'NS delegation changes require 24h advance notice' },
        { id: 'd14', name: 'DNSSEC Root KSK', eimId: 'EIM-00602', contactEmail: 'admin@iana.org', hosting: 'Other', notes: 'KSK rollover scheduled Q2 2026' },
      ],
      downstream: [
        { id: 'd15', name: 'Public Website CDN', eimId: 'EIM-00710', contactEmail: 'cdn-team@corp.com', hosting: 'AliCloud', notes: '' },
        { id: 'd16', name: 'API Gateway', eimId: 'EIM-00315', contactEmail: 'platform@corp.com', hosting: 'AliCloud', notes: '' },
        { id: 'd17', name: 'VPN Gateway', eimId: 'EIM-00521', contactEmail: 'network-ops@corp.com', hosting: 'On-Premise', notes: 'Split-horizon DNS required' },
      ],
      certificatesSecrets: {
        tlsCertificates: 'DNSSEC KSK and ZSK managed via AWS CloudHSM. KSK rollover scheduled Q2 2026.',
        secretsManagement: 'Registrar API credentials in AWS Secrets Manager',
        apiKeys: 'Route 53 API keys scoped per region — rotated every 90 days',
      },
    },

    nfrs: {
      peakLoad: '~850,000 queries/sec globally',
      autoscaling: 'Route 53 scales automatically. Edge nodes auto-scale via instance groups.',
      seasonalPatterns: 'Traffic spikes during major product launches and Black Friday (~3× baseline).',
      latencySensitivity: '< 10ms p99 globally for cached responses. < 50ms for authoritative resolution.',
      monitoring: 'Route 53 Health Checks + Datadog DNS monitoring + PagerDuty on-call',
      logAggregation: 'DNS query logs → CloudWatch Logs → S3 archival',
      compliance: ['ISO 27001', 'ICANN Compliance', 'GDPR (query log retention)'],
      licensing: 'Route 53 pay-per-query. Custom zone DB on PostgreSQL OSS.',
    },

    migrationConstraints: {
      migrationWindow: 'Rolling — region-by-region with no global maintenance window',
      maxCutoverWindow: '45 minutes per region (TTL drain period)',
      blackoutDates: [
        { name: 'Black Friday', from: '2025-11-29' },
        { name: 'Christmas', from: '2025-12-25' },
        { name: "New Year's Day", from: '2026-01-01' },
      ],
      changeFreezePeriods: [
        { name: 'Shopping season', from: '2025-11-25', to: '2025-12-01' },
        { name: 'Holiday freeze', from: '2025-12-20', to: '2026-01-05' },
      ],
      cutoverApproach: 'TTL pre-lowering to 60s, region-by-region NS record delegation swap. Each region validated before proceeding to next.',
      rollbackPlan: 'Re-delegate NS records to legacy nameservers. TTL already lowered so propagation takes < 2 minutes.',
      stakeholderComms: 'Network Ops, SRE, and CDN provider notified per-region. External status page updated for each cutover window.',
      preMigrationTesting: 'Full query validation suite run against shadow Route 53 zones. Propagation tested from 15 global vantage points.',
    },

    targetArchitecture: {
      summary: 'Full migration from on-prem BIND clusters to AWS Route 53 with Anycast edge via CloudFront. DNSSEC maintained end-to-end. EU secondary cluster cutover blocked pending propagation TTL issue resolution.',
      constraints: 'Zero tolerance for DNS resolution failures. DNSSEC chain of trust must not break at any point during migration. Registrar delegation changes require 24h advance notice.',
      reArchitectureNeeded: true,
      topology3Az: 'Route 53 is inherently multi-AZ. CloudFront edge PoPs cover all 3 AZs per region automatically.',
      replicationChanges: 'Replaced BIND zone transfers with Route 53 API-driven zone management. EU region still on BIND — pending final cutover.',
      dnsIpChanges: 'NS records for company.com updated to Route 53 nameservers in APAC and US. EU NS delegation still pointing to legacy BIND cluster.',
      newServicesRequired: ['AWS Route 53', 'AWS CloudHSM (DNSSEC)', 'CloudFront (edge resolution)'],
    },

    risks: [
      {
        id: 'r3',
        title: 'DNS propagation delay',
        description: 'Global DNS changes taking longer than expected to propagate. EU region TTL pre-lowering did not complete on schedule, delaying the NS delegation swap.',
        severity: 'critical',
        mitigation: 'Reduce TTL to 60s 48 hours before cutover. Monitor propagation from 15 global vantage points using dnschecker.org and internal tooling.',
        owner: 'Henry Wilson',
        riskStatus: 'open',
      },
      {
        id: 'r4',
        title: 'EU BIND Cluster Hardware EOL',
        description: 'The on-prem BIND hardware in the EU region reaches end-of-life in June 2026. If EU cutover is not completed before then, a hardware refresh will be required to maintain support.',
        severity: 'medium',
        mitigation: 'Escalated EU cutover as P1 blocker. Target completion by April 2026.',
        owner: 'Henry Wilson',
        riskStatus: 'in progress',
      },
    ],
  },
]

// ─── Waves ────────────────────────────────────────────────────────────────────

export const mockWaves: Wave[] = [
  {
    id: 'wave-1',
    name: 'Wave 3 – Q2 2026',
    startDate: '2026-04-01',
    cutoverDate: '2026-06-30',
    description: 'Third migration wave covering ERP and core finance systems.',
    jiraProjectKey: 'MIG',
    jiraEpicKey: 'MIG-42',
    source: 'imported',
    status: 'planned',
    createdAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'wave-2',
    name: 'Wave 4 – Q3 2026',
    startDate: '2026-07-01',
    cutoverDate: '2026-09-30',
    description: 'Fourth wave covering DNS infrastructure and network services.',
    jiraProjectKey: 'MIG',
    jiraEpicKey: 'MIG-58',
    source: 'created',
    status: 'planned',
    createdAt: '2026-02-01T09:00:00.000Z',
  },
  {
    id: 'wave-3',
    name: 'Wave 1 – Q4 2025',
    startDate: '2025-10-01',
    cutoverDate: '2025-12-31',
    description: 'First migration wave — pilot systems and non-critical workloads.',
    jiraProjectKey: 'MIG',
    jiraEpicKey: 'MIG-10',
    source: 'imported',
    status: 'completed',
    createdAt: '2025-08-01T08:00:00.000Z',
  },
]

export const mockCurrentUser: User = {
  id: 'u-current',
  name: 'Henry Wilson',
  email: 'henry.wilson@corp.com',
  department: 'Platform Engineering',
  role: 'Platform Migration Lead',
  initials: 'HW',
}

// ─── Dev Personas (dev-only user switcher) ────────────────────────────────────

export const devPersonas: User[] = [
  {
    id: 'u-current',
    name: 'Henry Wilson',
    email: 'henry.wilson@corp.com',
    department: 'Platform Engineering',
    role: 'Platform Migration Lead',
    initials: 'HW',
  },
  {
    id: 'u3',
    name: 'Alice Johnson',
    email: 'alice.johnson@corp.com',
    department: 'Platform Engineering',
    team: 'Platform Engineering',
    role: 'Technical Lead',
    initials: 'AJ',
  },
  {
    id: 'u12',
    name: 'Karen Lee',
    email: 'karen.lee@corp.com',
    department: 'Compliance & Risk',
    role: 'Business Owner',
    initials: 'KL',
  },
  {
    id: 'u2',
    name: 'Dan Brown',
    email: 'dan.brown@corp.com',
    department: 'Platform Engineering',
    team: 'Platform Engineering',
    initials: 'DB',
  },
]

// ─── Audit Log Seed Data ──────────────────────────────────────────────────────

export const mockAuditEntries: Record<string, AuditLogEntry[]> = {
  'PRJ-2024-ALPHA': [
    {
      id: 'al-a1',
      projectId: 'PRJ-2024-ALPHA',
      timestamp: '2026-03-21T09:15:00.000Z',
      actor: { id: 'u2', name: 'Dan Brown', initials: 'DB' },
      eventType: 'section_updated',
      entityType: 'section',
      sectionKey: 'applicationOverview',
      sectionLabel: 'Application Overview',
      changes: [
        { field: 'applicationTier', label: 'App Tier', oldValue: 'P2', newValue: 'P1' },
        { field: 'eimId', label: 'EIM ID', oldValue: undefined, newValue: 'EIM-00421' },
      ],
    },
    {
      id: 'al-a2',
      projectId: 'PRJ-2024-ALPHA',
      timestamp: '2026-03-21T11:30:00.000Z',
      actor: { id: 'u4', name: 'Bob Smith', initials: 'BS' },
      eventType: 'risk_created',
      entityType: 'risk',
      entityId: 'r1',
      entityLabel: 'Single-AZ Oracle DB failover untested',
      sectionKey: 'risks',
      sectionLabel: 'Risks & Blockers',
      changes: [
        { field: 'title', label: 'Title', oldValue: undefined, newValue: 'Single-AZ Oracle DB failover untested' },
        { field: 'severity', label: 'Severity', oldValue: undefined, newValue: 'critical' },
        { field: 'owner', label: 'Owner', oldValue: undefined, newValue: 'Bob Smith' },
      ],
    },
    {
      id: 'al-a3',
      projectId: 'PRJ-2024-ALPHA',
      timestamp: '2026-03-21T14:20:00.000Z',
      actor: { id: 'u1', name: 'Sarah Jenkins', initials: 'SJ' },
      eventType: 'section_updated',
      entityType: 'section',
      sectionKey: 'availability',
      sectionLabel: 'Availability & Resilience',
      changes: [
        { field: 'rto', label: 'RTO', oldValue: '4 hours', newValue: '2 hours' },
        { field: 'azReadiness3Az', label: '3-AZ Readiness', oldValue: 'Partial', newValue: 'In progress — stateful components need re-architecture' },
      ],
    },
    {
      id: 'al-a4',
      projectId: 'PRJ-2024-ALPHA',
      timestamp: '2026-03-22T08:45:00.000Z',
      actor: { id: 'u2', name: 'Dan Brown', initials: 'DB' },
      eventType: 'resource_sync_completed',
      entityType: 'cloud_resource',
      entityId: 'res2',
      entityLabel: 'Primary Oracle DB',
      sectionKey: 'currentInfrastructure',
      sectionLabel: 'Current Infrastructure',
      changes: [
        { field: 'syncStatus', label: 'Sync Status', oldValue: 'out-of-sync', newValue: 'synced' },
      ],
    },
    {
      id: 'al-a5',
      projectId: 'PRJ-2024-ALPHA',
      timestamp: '2026-03-22T10:12:00.000Z',
      actor: { id: 'u1', name: 'Sarah Jenkins', initials: 'SJ' },
      eventType: 'approval_submitted',
      entityType: 'approval',
      entityId: 'a1',
      entityLabel: 'Technical Lead Sign-off',
      sectionKey: 'approvals',
      sectionLabel: 'Sign-off',
      changes: [
        { field: 'status', label: 'Status', oldValue: 'pending', newValue: 'approved' },
        { field: 'approver', label: 'Approver', oldValue: undefined, newValue: 'Sarah Jenkins' },
      ],
    },
    {
      id: 'al-a6',
      projectId: 'PRJ-2024-ALPHA',
      timestamp: '2026-03-22T16:00:00.000Z',
      actor: { id: 'u3', name: 'Alice Johnson', initials: 'AJ' },
      eventType: 'section_updated',
      entityType: 'section',
      sectionKey: 'migrationConstraints',
      sectionLabel: 'Migration Constraints',
      changes: [
        { field: 'migrationWindow', label: 'Migration Window', oldValue: 'Weekends only', newValue: 'Saturdays 00:00–06:00 UTC' },
        { field: 'maxCutoverWindow', label: 'Max Cutover Window', oldValue: undefined, newValue: '4 hours' },
      ],
    },
    {
      id: 'al-a7',
      projectId: 'PRJ-2024-ALPHA',
      timestamp: '2026-03-23T09:05:00.000Z',
      actor: { id: 'u4', name: 'Bob Smith', initials: 'BS' },
      eventType: 'risk_updated',
      entityType: 'risk',
      entityId: 'r1',
      entityLabel: 'Single-AZ Oracle DB failover untested',
      sectionKey: 'risks',
      sectionLabel: 'Risks & Blockers',
      changes: [
        { field: 'riskStatus', label: 'Risk Status', oldValue: 'Open', newValue: 'In Mitigation' },
        { field: 'mitigation', label: 'Mitigation', oldValue: undefined, newValue: 'Scheduled failover drill for 29 Mar during maintenance window' },
      ],
    },
  ],

  'M-11029': [
    {
      id: 'al-b1',
      projectId: 'M-11029',
      timestamp: '2026-03-20T13:00:00.000Z',
      actor: { id: 'u7', name: 'Frank Miller', initials: 'FM' },
      eventType: 'section_updated',
      entityType: 'section',
      sectionKey: 'applicationOverview',
      sectionLabel: 'Application Overview',
      changes: [
        { field: 'applicationTier', label: 'App Tier', oldValue: undefined, newValue: 'P2' },
        { field: 'businessFunction', label: 'Business Function', oldValue: undefined, newValue: 'Network access management and VPN gateway services for 800 internal users.' },
      ],
    },
    {
      id: 'al-b2',
      projectId: 'M-11029',
      timestamp: '2026-03-21T15:20:00.000Z',
      actor: { id: 'u6', name: 'Eve Davis', initials: 'ED' },
      eventType: 'status_changed',
      entityType: 'project',
      sectionKey: 'status',
      entityLabel: 'Project Status',
      changes: [
        { field: 'status', label: 'Status', oldValue: 'planning', newValue: 'in-progress' },
      ],
    },
    {
      id: 'al-b3',
      projectId: 'M-11029',
      timestamp: '2026-03-22T09:40:00.000Z',
      actor: { id: 'u9', name: 'Henry Wilson', initials: 'HW' },
      eventType: 'resource_updated',
      entityType: 'cloud_resource',
      entityId: 'res-b1',
      entityLabel: 'VPN Gateway',
      sectionKey: 'currentInfrastructure',
      sectionLabel: 'Current Infrastructure',
      changes: [
        { field: 'targetStatus', label: 'Target Status', oldValue: 'Planned', newValue: 'Provisioning' },
        { field: 'availabilityZones', label: 'Availability Zones', oldValue: ['AZ-A'], newValue: ['AZ-A', 'AZ-B', 'AZ-C'] },
      ],
    },
    {
      id: 'al-b4',
      projectId: 'M-11029',
      timestamp: '2026-03-22T14:10:00.000Z',
      actor: { id: 'u7', name: 'Frank Miller', initials: 'FM' },
      eventType: 'risk_created',
      entityType: 'risk',
      entityId: 'r-b1',
      entityLabel: 'BGP routing convergence delay',
      sectionKey: 'risks',
      sectionLabel: 'Risks & Blockers',
      changes: [
        { field: 'title', label: 'Title', oldValue: undefined, newValue: 'BGP routing convergence delay' },
        { field: 'severity', label: 'Severity', oldValue: undefined, newValue: 'medium' },
      ],
    },
    {
      id: 'al-b5',
      projectId: 'M-11029',
      timestamp: '2026-03-23T08:30:00.000Z',
      actor: { id: 'u6', name: 'Eve Davis', initials: 'ED' },
      eventType: 'section_updated',
      entityType: 'section',
      sectionKey: 'nfrs',
      sectionLabel: 'Non-Functional Requirements',
      changes: [
        { field: 'compliance', label: 'Compliance', oldValue: [], newValue: ['ISO 27001', 'SOC 2'] },
        { field: 'monitoring', label: 'Monitoring', oldValue: 'Basic CloudWatch', newValue: 'Datadog with PagerDuty integration' },
      ],
    },
  ],

  'M-77122': [
    {
      id: 'al-c1',
      projectId: 'M-77122',
      timestamp: '2026-03-19T10:00:00.000Z',
      actor: { id: 'u10', name: 'Irene Cho', initials: 'IC' },
      eventType: 'section_updated',
      entityType: 'section',
      sectionKey: 'dataPersistence',
      sectionLabel: 'Data & Persistence',
      changes: [
        { field: 'totalDataVolume', label: 'Total Data Volume', oldValue: undefined, newValue: '8 TB' },
        { field: 'piiData', label: 'PII Data', oldValue: false, newValue: true },
        { field: 'dataResidency', label: 'Data Residency', oldValue: undefined, newValue: 'EU-West only' },
      ],
    },
    {
      id: 'al-c2',
      projectId: 'M-77122',
      timestamp: '2026-03-20T11:50:00.000Z',
      actor: { id: 'u9', name: 'Henry Wilson', initials: 'HW' },
      eventType: 'risk_created',
      entityType: 'risk',
      entityId: 'r-c1',
      entityLabel: 'PII data residency compliance gap',
      sectionKey: 'risks',
      sectionLabel: 'Risks & Blockers',
      changes: [
        { field: 'title', label: 'Title', oldValue: undefined, newValue: 'PII data residency compliance gap' },
        { field: 'severity', label: 'Severity', oldValue: undefined, newValue: 'critical' },
        { field: 'owner', label: 'Owner', oldValue: undefined, newValue: 'Irene Cho' },
      ],
    },
    {
      id: 'al-c3',
      projectId: 'M-77122',
      timestamp: '2026-03-21T09:30:00.000Z',
      actor: { id: 'u11', name: 'James Park', initials: 'JP' },
      eventType: 'section_updated',
      entityType: 'section',
      sectionKey: 'targetArchitecture',
      sectionLabel: 'Target Architecture',
      changes: [
        { field: 'reArchitectureNeeded', label: 'Re-Architecture Needed', oldValue: false, newValue: true },
        { field: 'summary', label: 'Summary', oldValue: 'Lift and shift', newValue: 'Refactor to microservices with event-driven data pipeline' },
      ],
    },
    {
      id: 'al-c4',
      projectId: 'M-77122',
      timestamp: '2026-03-22T13:15:00.000Z',
      actor: { id: 'u10', name: 'Irene Cho', initials: 'IC' },
      eventType: 'resource_sync_completed',
      entityType: 'cloud_resource',
      entityId: 'res-c2',
      entityLabel: 'Analytics PostgreSQL Cluster',
      sectionKey: 'currentInfrastructure',
      sectionLabel: 'Current Infrastructure',
      changes: [
        { field: 'syncStatus', label: 'Sync Status', oldValue: 'out-of-sync', newValue: 'synced' },
      ],
    },
    {
      id: 'al-c5',
      projectId: 'M-77122',
      timestamp: '2026-03-23T07:45:00.000Z',
      actor: { id: 'u12', name: 'Karen Lee', initials: 'KL' },
      eventType: 'section_updated',
      entityType: 'section',
      sectionKey: 'nfrs',
      sectionLabel: 'Non-Functional Requirements',
      changes: [
        { field: 'compliance', label: 'Compliance', oldValue: ['ISO 27001'], newValue: ['ISO 27001', 'GDPR', 'SOC 2 Type II'] },
      ],
    },
  ],
}
