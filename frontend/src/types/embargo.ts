export interface EmbargoRecord {
  id: string
  name: string
  startDate: string             // ISO date 'yyyy-MM-dd'
  endDate: string               // ISO date 'yyyy-MM-dd'
  affectedServiceLines: string[]
  createdAt: string             // ISO 8601
}
