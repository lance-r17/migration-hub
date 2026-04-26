export interface ServiceAccount {
  id: string
  name: string
  email: string
  department: string
  initials: string
}

export interface ServiceAccountCreate {
  name: string
  email: string
  department: string
}

export interface ServiceAccountUpdate {
  name?: string
  email?: string
  department?: string
}

export interface ServiceAccountTokenReset {
  id: string
  api_key: string
}
