export interface AdminAttachment {
  id: string
  projectId: string
  projectName: string
  filename: string
  filePath: string
  status: 'pending' | 'confirmed' | 'deleted'
  createdAt: string | null
}
