import type { EmailTemplate } from '@/types/email'
import {
  getAllTemplates,
  getTemplateById,
  upsertTemplate,
  deleteTemplate as storeDelete,
  createBlankTemplate,
} from '@/data/emailTemplates'
import { USE_MOCK, apiClient } from './client'
import { getEmailServerUrl } from '@/runtimeConfig'

const delay = (ms = 300) => new Promise(res => setTimeout(res, ms))

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  if (USE_MOCK) {
    await delay()
    return getAllTemplates()
  }
  return apiClient.get<EmailTemplate[]>('/api/v1/email-templates')
}

export async function getEmailTemplate(id: string): Promise<EmailTemplate> {
  if (USE_MOCK) {
    await delay()
    const t = getTemplateById(id)
    if (!t) throw new Error(`Template ${id} not found`)
    return t
  }
  return apiClient.get<EmailTemplate>(`/api/v1/email-templates/${id}`)
}

export async function saveEmailTemplate(template: EmailTemplate): Promise<EmailTemplate> {
  if (USE_MOCK) {
    await delay(400)
    return upsertTemplate(template)
  }
  return apiClient.put<EmailTemplate>(`/api/v1/email-templates/${template.id}`, template)
}

export async function createEmailTemplate(): Promise<EmailTemplate> {
  if (USE_MOCK) {
    await delay(200)
    const blank = createBlankTemplate()
    upsertTemplate(blank)
    return blank
  }
  return apiClient.post<EmailTemplate>('/api/v1/email-templates', {})
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  if (USE_MOCK) {
    await delay(300)
    storeDelete(id)
    return
  }
  await apiClient.delete<void>(`/api/v1/email-templates/${id}`)
}

export interface SendTestEmailPayload {
  templateId: string
  recipientEmail: string
  sampleData?: Record<string, string | Record<string, unknown>[]>
  htmlContent?: string
  subject?: string
}

export async function sendTestEmail(payload: SendTestEmailPayload): Promise<void> {
  const emailServerUrl = getEmailServerUrl()
  if (emailServerUrl) {
    const res = await fetch(`${emailServerUrl}/api/v1/email-templates/send-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientEmail: payload.recipientEmail,
        subject: payload.subject,
        htmlContent: payload.htmlContent,
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error ?? 'Failed to send test email')
    }
    return
  }

  if (USE_MOCK) {
    await delay(800)
    // Mock: no email server configured — silently succeed
    return
  }

  await apiClient.post<void>('/api/v1/email-templates/send-test', payload)
}
