export interface ServiceAccount {
  id: string
  name: string
  email: string
  department: string
  initials: string
  is_admin: boolean
}

export interface ServiceAccountCreate {
  name: string
  email: string
  department: string
  is_admin?: boolean
}

export interface ServiceAccountUpdate {
  name?: string
  email?: string
  department?: string
  is_admin?: boolean
}

export interface ServiceAccountTokenReset {
  id: string
  api_key: string
}
