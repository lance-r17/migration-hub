# New App 4

**Application Profile:** [New App 4]

**How to use:** Fields marked are mandatory before wave assignment. Replace all placeholder text with real values.
*Delete this note when submitting for review.*

| Field | Value |
| :--- | :--- |
| Status | DRAFT |
| Migration Wave * | TBD - assign after approval |
| Criticality * | P2 |
| Profile Owner | Name, Team |
| Technical Lead * | Name, Team, email |
| Business Owner | Name, Department, email |
| Jira Ticket | JIRA-123 |
| Last Updated | 02 FEB 2027 |

---

## 1. Application overview

| Field | Details |
| :--- | :--- |
| Application name | Full name as it appears in the EIM |
| Short name / alias | e.g. OMS, CRM-Core |
| Business owner * | Name, department, email |
| Technical lead * | Name, team, email |
| DBA/data owner | Name if separate from technical lead |
| Business function | What does this application do? Who uses it and how critical is it to daily operations? |
| User base | Internal only/External customers/Both-approx. number of users |
| Application tier | P1-Mission critical/P2-Business important/P3-Low criticality |
| EIM ID | Reference ID in your EIM |

---

## 2. Current infrastructure
Describe the current 2AZ private cloud deployment. Be specific vague entries will be returned for clarification.

### Compute

| Component | Type | Specs | Quantity | Availability Zones |
| :--- | :--- | :--- | :--- | :--- |
| e.g. App server | VM/Container/Bare metal | 4 vCPU, 16 GB RAM | 2 | AZ-A+AZ-B |
| e.g. DB server | VM | 8 vCPU, 64 GB RAM | 2 | AZ-A primary, AZ-B replica |

### Storage
Block/NFS/Object e.g. 2 TB e.g. 3,000 IOPS Sync/Async/None Daily/Hourly

### Network

| Configuration | Details |
| :--- | :--- |
| Load balancer type | L4/L7/DNS round-robin-product name if known |
| VIP/DNS names | List all virtual IPs and hostnames used by this application |
| Firewall zones | Which security zones does traffic traverse? Any dedicated firewall rules? |
| Bandwidth requirements | Peak ingress/egress in Mbps or Gbps |
| Hardcoded IPs? | Yes/No if Yes, list them and where they are referenced |
| Private connectivity | Any dedicated links, MPLS, or private peering that needs replication? |

---

## 3. Availability and resilience

| Requirement | Details |
| :--- | :--- |
| RTO * | Maximum acceptable downtime e.g. 4 hours, 30 minutes |
| RPO | Maximum acceptable data losse.g. 1 hour, zero |
| Availability SLA | e.g. 99.9% (3 nines), 99.95% |
| Current AZ pattern * | Active-active/Active-passive/Single-AZ/Other - describe |
| AZ-aware today? | Yes/No does the app handle AZ failure gracefully or require manual intervention? |
| AZ failure behaviour | What actually happens if AZ-A fails today? Auto-failover, manual failover, full outage? |
| 3AZ readiness | Is there any logic (quorum, replication factor, session affinity) that assumes exactly 2 AZs? If yes, describe. |
| Health check endpoints | List any/health or /status endpoints used by load balancers or monitoring |

### Current 2AZ topology
Describe what runs in AZ-A-primary DB, active app nodes, etc. Describe what runs in AZ-B- replica DB, standby nodes, etc.

---

## 4. Data and persistence

| Characteristic | Details |
| :--- | :--- |
| Database type(s) * | e.g. RDB PG, PolarDB PG, MSSQL, MongoDB, Redis |
| Total data volume | Approximate GB/TB across all databases |
| Data growth rate | e.g. -50 GB/month |
| Replication topology | Describe replication primary/replica, synchronous/asynchronous, clustering |
| Backup method and location | Tool used, frequency, retention period, and where backups are stored |
| Last restore test | Date of last successful restore test |
| Data residency requirements | Any legal, regulatory, or contractual requirements on where data can reside? |
| Encryption at rest | Yes/No if Yes, key management approach |
| Pll/sensitive data? | Yes/No-if Yes, data classification level |
| Stateful components | List any stateful workloads beyond the DB (file shares, session stores, persistent queues) |

---

## 5. Dependencies
List every upstream and downstream dependency. Undeclared dependencies are a leading cause of migration failures.

### Upstream
what this app calls

| Dependency | Protocol | Port | Access | Owner | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| e.g. Auth Service | API | HTTPS 443 | Internal | Team name | |
| e.g. Payment Gateway | API | HTTPS 443 | External | N/A vendor | Allowlist IP change needed |

### Downstream
what calls this app
* e.g. Frontend Web App API HTTPS 443 Internal Team name

### Certificates and secrets

| Type | Details |
| :--- | :--- |
| TLS certificates | List certificates, issuing CA, and expiry dates. Flag any expiring within 6 months of migration. |
| Secrets management | How are secrets managed today Vault, CyberArk, flat files, env vars? |
| API keys / tokens | Any third-party API keys that are IP-restricted and will need updating post-migration? |

---

## 6. Non-functional requirements

| Requirement | Details |
| :--- | :--- |
| Peak load profile | When does peak load occur? TPS, concurrent users, or requests/sec? |
| Seasonal patterns | Any seasonal spikes (e.g. year-end, Black Friday) to avoid scheduling migration around? |
| Latency sensitivity | Any sub-millisecond or low-latency requirements affected by cross-AZ round trips? |
| Licensing constraints | Any per-socket, per-core, or per-node licensing needing reassessment in the new environment? |
| Compliance requirements | PCI, ISO 27001, SOC2, GDPR, or other compliance obligations affecting the migration approach |
| Monitoring and alerting | What monitoring tools are in use? Are alert thresholds tied to current IPs/hostnames? |
| Log aggregation | Where do logs go? Any log shippers that need reconfiguring? |
| Autoscaling | Does the app scale horizontally today? If yes, describe the mechanism. |

---

## 7. Migration constraints

| Constraint | Details |
| :--- | :--- |
| Preferred migration window | Day of week, time of day, and timezone for the cutover |
| Blackout dates | Dates when migration CANNOT happen business events, freeze periods, audits |
| Change freeze periods | Any org-wide change freeze windows that apply |
| Max cutover window | How long can the application be down or degraded during cutover? |
| Cutover approach | Big-bang/Phased (describe phases) / Blue-green/Canary |
| Rollback plan | How will the application be rolled back if migration fails? Estimated rollback time? |
| Stakeholder comms required? | Who needs to be notified, and with how much lead time? |
| Pre-migration testing | What testing must be completed before cutover is approved? Who signs off? |

---

## 8. Target architecture notes
Describe how the application will look in the 3AZ cloud environment. Flag any re-architecture required.

| Architecture Element | Details |
| :--- | :--- |
| Re-architecture needed? * | Yes/No if Yes, describe what needs to change and estimated effort |
| 3AZ topology (target) | How will the app be distributed across AZ-1, AZ-2, AZ-3? |
| Changes to replication | Any changes needed to DB replication factor, quorum config, or cluster topology for 3AZs? |
| DNS/IP changes | Expected DNS or IP changes and which consumers will need updating |
| New services required | Any new cloud-native services needed in the target environment |
| Architecture diagram | Attach or link to a target architecture diagram |

---

## 9. Risks and blockers

| Risk / Blocker | Severity | Description | Mitigation | Owner | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| e.g. DB quorum assumes 2 nodes | High | App uses 2-node quorum that will break in 3AZ | Re-architect to 3-node quorum before migration | DBA team | Open |
| e.g. Expiring TLS cert | Medium | Cert expires 3 weeks post-migration | Renew cert as part of migration prep | Tech lead | In progress |
| e.g. Hardcoded IP in config | Low | Two config files reference AZ-A IP directly | Update config to use DNS name pre-migration | Dev team | Resolved |

---

## 10. Sign-off
All three sign-offs required before this profile is marked Approved in Jira and assigned to a migration wave.

**Technical lead**
* Not started

**Business owner**
* Not started

**Migration lead review**
* Not started

*Migration Application Profile v1.0 - fields marked are mandatory for wave assignment*
