export interface BgiNode {
  id: string
  name: string
  children?: BgiNode[]
}

export interface BgiHierarchy {
  root: BgiNode | null
}

export interface BgiCloudLeadUser {
  id: string
  name: string
  email: string
  department: string
  team?: string
  initials: string
  role: string[]
  bgi_ids: string[]
}
