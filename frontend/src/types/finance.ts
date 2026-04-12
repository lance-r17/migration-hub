export interface BillingRecord {
  resourceSet: string
  amount: number
}

export interface BillingUpload {
  month: string        // YYYY-MM format e.g. "2026-03"
  env: 'existing' | 'target'
  records: BillingRecord[]
}

export interface BillingThresholdConfig {
  healthyAtRiskThreshold: number  // ratio below this = "Healthy"; default 100
  atRiskOverThreshold: number     // ratio above this = "Over"; default 120
}
