import type { EmailTemplate } from '@/types/email'
import {
  getAllTemplates,
  getTemplateById,
  upsertTemplate,
  deleteTemplate as storeDelete,
  createBlankTemplate,
} from '@/data/emailTemplates'
import { USE_MOCK } from './client'
import { getEmailServerUrl } from '@/runtimeConfig'

const delay = (ms = 300) => new Promise(res => setTimeout(res, ms))

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  if (USE_MOCK) {
    await delay()
    return getAllTemplates()
  }
  const res = await fetch('/api/v1/email-templates')
  return res.json()
}

export async function getEmailTemplate(id: string): Promise<EmailTemplate> {
  if (USE_MOCK) {
    await delay()
    const t = getTemplateById(id)
    if (!t) throw new Error(`Template ${id} not found`)
    return t
  }
  const res = await fetch(`/api/v1/email-templates/${id}`)
  return res.json()
}

export async function saveEmailTemplate(template: EmailTemplate): Promise<EmailTemplate> {
  if (USE_MOCK) {
    await delay(400)
    return upsertTemplate(template)
  }
  const res = await fetch(`/api/v1/email-templates/${template.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template),
  })
  return res.json()
}

export async function createEmailTemplate(): Promise<EmailTemplate> {
  if (USE_MOCK) {
    await delay(200)
    const blank = createBlankTemplate()
    upsertTemplate(blank)
    return blank
  }
  const res = await fetch('/api/v1/email-templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  return res.json()
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  if (USE_MOCK) {
    await delay(300)
    storeDelete(id)
    return
  }
  await fetch(`/api/v1/email-templates/${id}`, { method: 'DELETE' })
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

  const res = await fetch('/api/v1/email-templates/send-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Failed to send test email')
}
