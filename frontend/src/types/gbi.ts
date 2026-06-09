export interface GbiNode {
  id: string
  name: string
  children?: GbiNode[]
}

export interface GbiHierarchy {
  root: GbiNode | null
}

export interface GbiCloudLeadUser {
  id: string
  name: string
  email: string
  department: string
  team?: string
  initials: string
  role: string[]
  gbi_ids: string[]
}
