import type { EmailTemplate, EmailRow, EmailColumn, EmailComponent, TableConfig } from '@/types/email'
import { DEFAULT_TEMPLATE_STYLE } from '@/types/email'

// ─── Helpers ────────────────────────────────────────────────────────────────

let idSeq = 1
const uid = () => `em-${Date.now()}-${idSeq++}`

function textComponent(html: string, textAlign: 'left' | 'center' | 'right' = 'left'): EmailComponent {
  return {
    id: uid(),
    type: 'text',
    style: { paddingTop: 8, paddingBottom: 8, paddingLeft: 0, paddingRight: 0, textAlign },
    content: { html },
    config: {},
  }
}

function ctaComponent(buttonText: string, linkUrl: string, bg = '#A67C52', color = '#ffffff'): EmailComponent {
  return {
    id: uid(),
    type: 'cta',
    style: { paddingTop: 16, paddingBottom: 16, textAlign: 'center', backgroundColor: bg, textColor: color, borderRadius: 6 },
    content: { buttonText },
    config: { linkUrl, openInNewTab: true },
  }
}

function dividerComponent(): EmailComponent {
  return {
    id: uid(),
    type: 'divider',
    style: { paddingTop: 12, paddingBottom: 12 },
    content: { color: '#e5e7eb', thickness: 1 },
    config: {},
  }
}

function spacerComponent(height = 16): EmailComponent {
  return {
    id: uid(),
    type: 'spacer',
    style: {},
    content: { spacerHeight: height },
    config: {},
  }
}

function fullRow(components: EmailComponent[]): EmailRow {
  const col: EmailColumn = { id: uid(), components }
  return { id: uid(), layout: 'full', columns: [col] }
}

function twoColRow(left: EmailComponent[], right: EmailComponent[]): EmailRow {
  return {
    id: uid(),
    layout: 'two-col',
    columns: [
      { id: uid(), components: left },
      { id: uid(), components: right },
    ],
  }
}

function tableRow(config: TableConfig): EmailRow {
  const cols: EmailColumn[] = Array.from({ length: config.numCols }, () => ({ id: uid(), components: [] }))
  return { id: uid(), layout: 'table', columns: cols, tableConfig: config }
}

// ─── Pre-defined Templates ────────────────────────────────────────────────────

const predefined: EmailTemplate[] = [
  // 1. Wave Assigned
  {
    id: 'tpl-wave-assigned',
    name: 'Migration Wave Assignment',
    description: 'Sent when a project is assigned to a migration wave.',
    eventType: 'wave_assigned',
    subject: 'Your project {{project.name}} has been assigned to {{wave.name}}',
    recipientList: [
      { type: 'project_field', field: 'technicalLead' },
      { type: 'project_field', field: 'businessOwner' },
    ],
    templateStyle: { ...DEFAULT_TEMPLATE_STYLE },
    isPredefined: true,
    createdAt: '2026-04-06T00:00:00Z',
    updatedAt: '2026-04-06T00:00:00Z',
    rows: [
      fullRow([spacerComponent(24)]),
      fullRow([textComponent('<h2><span style="font-size: 20px; color: #A67C52;">Wave Assignment Confirmed</span></h2>')]),
      fullRow([spacerComponent(8)]),
      fullRow([textComponent('<p>Hi {{user.name}},</p><p>Your application <strong>{{project.name}}</strong> has been assigned to <strong>{{wave.name}}</strong> with a planned cutover date of <strong>{{wave.cutoverDate}}</strong>.</p><p>Please review your migration readiness and ensure all sections are complete before the cutover window.</p>')]),
      fullRow([spacerComponent(16)]),
      fullRow([ctaComponent('View Jira Epic →', '{{jiraBaseUrl}}/browse/{{jiraStoryKey}}')]),
      fullRow([spacerComponent(24)]),
      fullRow([dividerComponent()]),
      fullRow([textComponent('<p><span style="font-size: 12px; color: #6b7280;">This is an automated message from <a href="{{platform.url}}" style="color: #6b7280;">{{platform.name}}</a>. Do not reply to this email.</span></p>', 'center')]),
    ],
  },

  // 2. Sign-Off Required
  {
    id: 'tpl-signoff-required',
    name: 'Sign-Off Required',
    description: 'Sent to stakeholders when formal sign-off approval is needed.',
    eventType: 'sign_off_required',
    subject: 'Action Required: Sign-off needed for {{project.name}}',
    recipientList: [
      { type: 'role', role: 'technical_lead' },
      { type: 'role', role: 'business_owner' },
    ],
    templateStyle: { ...DEFAULT_TEMPLATE_STYLE },
    isPredefined: true,
    createdAt: '2026-04-06T00:00:00Z',
    updatedAt: '2026-04-06T00:00:00Z',
    rows: [
      fullRow([spacerComponent(24)]),
      fullRow([textComponent('<h2><span style="font-size: 20px; color: #A67C52;">Sign-Off Approval Required</span></h2>')]),
      fullRow([spacerComponent(8)]),
      fullRow([textComponent('<p>Hi {{user.name}},</p><p>The migration project <strong>{{project.name}}</strong> is awaiting your formal sign-off. Your approval is required to proceed with the cutover process.</p><p>Please review all migration sections and submit your approval at your earliest convenience.</p>')]),
      fullRow([spacerComponent(16)]),
      fullRow([ctaComponent('Review & Approve →', '{{platform.url}}/projects/{{project.id}}')]),
      fullRow([spacerComponent(24)]),
      fullRow([dividerComponent()]),
      fullRow([textComponent('<p><span style="font-size: 12px; color: #6b7280;">This is an automated message from <a href="{{platform.url}}" style="color: #6b7280;">{{platform.name}}</a>. Do not reply to this email.</span></p>', 'center')]),
    ],
  },

  // 3. Project Signed Off
  {
    id: 'tpl-project-signedoff',
    name: 'Project Signed Off',
    description: 'Confirmation email when all approvals have been submitted.',
    eventType: 'project_signed_off',
    subject: '{{project.name}} has been fully signed off',
    recipientList: [
      { type: 'role', role: 'platform_migration_lead' },
      { type: 'project_field', field: 'technicalLead' },
      { type: 'project_field', field: 'businessOwner' },
    ],
    templateStyle: { ...DEFAULT_TEMPLATE_STYLE },
    isPredefined: true,
    createdAt: '2026-04-06T00:00:00Z',
    updatedAt: '2026-04-06T00:00:00Z',
    rows: [
      fullRow([spacerComponent(24)]),
      fullRow([textComponent('<h2><span style="font-size: 20px; color: #A67C52;">Migration Sign-Off Complete ✓</span></h2>')]),
      fullRow([spacerComponent(8)]),
      fullRow([textComponent('<p>Hi {{user.name}},</p><p>Great news — <strong>{{project.name}}</strong> has received all required approvals and is now officially signed off for migration.</p><p>Jira migration tasks have been automatically created. You can track progress through the Jira epic below.</p>')]),
      fullRow([spacerComponent(16)]),
      fullRow([ctaComponent('View Jira Epic →', '{{jiraBaseUrl}}/browse/{{jiraStoryKey}}')]),
      fullRow([spacerComponent(24)]),
      fullRow([dividerComponent()]),
      fullRow([textComponent('<p><span style="font-size: 12px; color: #6b7280;">This is an automated message from <a href="{{platform.url}}" style="color: #6b7280;">{{platform.name}}</a>. Do not reply to this email.</span></p>', 'center')]),
    ],
  },

  // 4. Risk Alert
  {
    id: 'tpl-risk-alert',
    name: 'Risk Alert',
    description: 'Notification when a risk is raised on a project, reflecting the severity of the risk item.',
    eventType: 'risk_alert',
    subject: '⚠ {{risk.severityLabel}} Risk Alert: {{risk.title}} in {{project.name}}',
    recipientList: [
      { type: 'role', role: 'platform_migration_lead' },
      { type: 'project_field', field: 'technicalLead' },
    ],
    templateStyle: { ...DEFAULT_TEMPLATE_STYLE },
    isPredefined: true,
    createdAt: '2026-04-06T00:00:00Z',
    updatedAt: '2026-04-06T00:00:00Z',
    rows: [
      fullRow([spacerComponent(24)]),
      fullRow([textComponent('<h2><span style="font-size: 20px; color: #A67C52;">⚠ {{risk.severityLabel}} Risk Identified</span></h2>')]),
      fullRow([spacerComponent(8)]),
      fullRow([textComponent('<p>Hi {{user.name}},</p><p>A {{risk.severity}} risk has been raised on project <strong>{{project.name}}</strong> that requires your attention.</p>')]),
      fullRow([dividerComponent()]),
      twoColRow(
        [textComponent('<p><strong><span style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Risk Title</span></strong></p><p><strong>{{risk.title}}</strong></p>')],
        [textComponent('<p><strong><span style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Severity</span></strong></p><p><strong><span style="color: #A67C52;">{{risk.severity}}</span></strong></p>')]
      ),
      fullRow([spacerComponent(8)]),
      fullRow([textComponent('<p><strong><span style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Description</span></strong></p><p>{{risk.description}}</p>')]),
      fullRow([dividerComponent()]),
      fullRow([spacerComponent(8)]),
      fullRow([ctaComponent('View Project Risks →', '{{platform.url}}/projects/{{project.id}}')]),
      fullRow([spacerComponent(24)]),
      fullRow([dividerComponent()]),
      fullRow([textComponent('<p><span style="font-size: 12px; color: #6b7280;">This is an automated message from <a href="{{platform.url}}" style="color: #6b7280;">{{platform.name}}</a>. Do not reply to this email.</span></p>', 'center')]),
    ],
  },

  // 5. Cutover Reminder
  {
    id: 'tpl-cutover-reminder',
    name: 'Cutover Reminder',
    description: 'Reminder sent X days before the wave cutover date.',
    eventType: 'cutover_reminder',
    subject: 'Reminder: {{wave.name}} cutover in {{daysUntilCutover}} days',
    recipientList: [
      { type: 'project_field', field: 'technicalLead' },
      { type: 'project_field', field: 'businessOwner' },
    ],
    templateStyle: { ...DEFAULT_TEMPLATE_STYLE },
    isPredefined: true,
    createdAt: '2026-04-06T00:00:00Z',
    updatedAt: '2026-04-06T00:00:00Z',
    rows: [
      fullRow([spacerComponent(24)]),
      fullRow([textComponent('<h2><span style="font-size: 20px; color: #A67C52;">Cutover Approaching</span></h2>')]),
      fullRow([spacerComponent(8)]),
      fullRow([textComponent('<p>Hi {{user.name}},</p><p>This is a reminder that the cutover date for <strong>{{wave.name}}</strong> is in <strong>{{daysUntilCutover}} days</strong> (<strong>{{wave.cutoverDate}}</strong>).</p><p>Please ensure all migration sign-offs and Jira tasks for your application are completed before the cutover window.</p>')]),
      fullRow([spacerComponent(16)]),
      fullRow([ctaComponent('View Jira Epic →', '{{jiraBaseUrl}}/browse/{{jiraStoryKey}}')]),
      fullRow([spacerComponent(24)]),
      fullRow([dividerComponent()]),
      fullRow([textComponent('<p><span style="font-size: 12px; color: #6b7280;">This is an automated message from <a href="{{platform.url}}" style="color: #6b7280;">{{platform.name}}</a>. Do not reply to this email.</span></p>', 'center')]),
    ],
  },

  // 6. Approval Submitted
  {
    id: 'tpl-approval-submitted',
    name: 'Approval Submitted',
    description: 'Notification when an individual approval is submitted for a project.',
    eventType: 'approval_submitted',
    subject: '{{approver.name}} has approved {{project.name}}',
    recipientList: [{ type: 'role', role: 'platform_migration_lead' }],
    templateStyle: { ...DEFAULT_TEMPLATE_STYLE },
    isPredefined: true,
    createdAt: '2026-04-06T00:00:00Z',
    updatedAt: '2026-04-06T00:00:00Z',
    rows: [
      fullRow([spacerComponent(32)]),
      fullRow([textComponent('<h2><span style="font-size: 20px; color: #A67C52;">Approval Received</span></h2>')]),
      fullRow([spacerComponent(8)]),
      fullRow([textComponent('<p>Hi {{user.name}},</p><p><strong>{{approver.name}}</strong> has submitted their approval for <strong>{{project.name}}</strong>.</p><p>Please review the current approval status and check if all required approvals have been collected.</p>')]),
      fullRow([spacerComponent(16)]),
      fullRow([ctaComponent('View Sign-Off Status →', '{{platform.url}}/projects/{{project.id}}')]),
      fullRow([spacerComponent(24)]),
      fullRow([dividerComponent()]),
      fullRow([textComponent('<p><span style="font-size: 12px; color: #6b7280;">This is an automated message from <a href="{{platform.url}}" style="color: #6b7280;">{{platform.name}}</a>. Do not reply to this email.</span></p>', 'center')]),
    ],
  },

  // 7. Jira Stories Created
  {
    id: 'tpl-jira-created',
    name: 'Jira Stories Created',
    description: 'Sent when migration Jira stories/subtasks are auto-created after sign-off.',
    eventType: 'jira_stories_created',
    subject: 'Migration tasks for {{project.name}} are ready in Jira',
    recipientList: [
      { type: 'project_field', field: 'technicalLead' },
      { type: 'role', role: 'platform_migration_lead' },
    ],
    templateStyle: { ...DEFAULT_TEMPLATE_STYLE },
    isPredefined: true,
    createdAt: '2026-04-06T00:00:00Z',
    updatedAt: '2026-04-06T00:00:00Z',
    rows: [
      fullRow([spacerComponent(24)]),
      fullRow([textComponent('<h2><span style="font-size: 20px; color: #A67C52;">Jira Migration Tasks Created</span></h2>')]),
      fullRow([spacerComponent(8)]),
      fullRow([textComponent('<p>Hi {{user.name}},</p><p>Migration tasks for <strong>{{project.name}}</strong> have been automatically created in Jira following the completed sign-off.</p><p>Each cloud resource now has a corresponding Jira subtask under epic <strong>{{jiraStoryKey}}</strong>. Assign tasks to your team and begin tracking migration progress in Jira.</p>')]),
      fullRow([spacerComponent(16)]),
      tableRow({
        numCols: 4,
        numRows: 3,
        headerEnabled: true,
        headerTexts: ['Resource Name', 'Product', 'Category', 'Jira Ticket'],
        dataSource: 'project.currentInfrastructure.resources',
        columnConfigs: [
          { fieldKey: 'name', type: 'text' },
          { fieldKey: 'product', type: 'text' },
          { fieldKey: 'category', type: 'text' },
          { fieldKey: 'jiraSubtaskKey', type: 'link', linkPattern: '{{jiraBaseUrl}}/browse/{jiraSubtaskKey}' },
        ],
      }),
      fullRow([spacerComponent(16)]),
      fullRow([ctaComponent('Open in Jira →', '{{jiraBaseUrl}}/browse/{{jiraStoryKey}}')]),
      fullRow([spacerComponent(24)]),
      fullRow([dividerComponent()]),
      fullRow([textComponent('<p><span style="font-size: 12px; color: #6b7280;">This is an automated message from <a href="{{platform.url}}" style="color: #6b7280;">{{platform.name}}</a>. Do not reply to this email.</span></p>', 'center')]),
    ],
  },

  // 8. Survey Submitted
  {
    id: 'tpl-survey-submitted',
    name: 'Survey Submitted',
    description: 'Confirmation when an application owner completes the migration readiness survey.',
    eventType: 'survey_submitted',
    subject: '{{project.name}} migration readiness survey completed',
    recipientList: [
      { type: 'role', role: 'platform_migration_lead' },
      { type: 'project_field', field: 'technicalLead' },
    ],
    templateStyle: { ...DEFAULT_TEMPLATE_STYLE },
    isPredefined: true,
    createdAt: '2026-04-06T00:00:00Z',
    updatedAt: '2026-04-06T00:00:00Z',
    rows: [
      fullRow([spacerComponent(32)]),
      fullRow([textComponent('<h2><span style="font-size: 20px; color: #A67C52;">Survey Completed ✓</span></h2>')]),
      fullRow([spacerComponent(8)]),
      fullRow([textComponent('<p>Hi {{user.name}},</p><p>The migration readiness survey for <strong>{{project.name}}</strong> has been submitted. The platform team can now review the submitted information and proceed with migration planning.</p>')]),
      fullRow([spacerComponent(16)]),
      fullRow([ctaComponent('View Project Details →', '{{platform.url}}/projects/{{project.id}}')]),
      fullRow([spacerComponent(24)]),
      fullRow([dividerComponent()]),
      fullRow([textComponent('<p><span style="font-size: 12px; color: #6b7280;">This is an automated message from <a href="{{platform.url}}" style="color: #6b7280;">{{platform.name}}</a>. Do not reply to this email.</span></p>', 'center')]),
    ],
  },
]

// ─── In-memory store ──────────────────────────────────────────────────────────

let store: EmailTemplate[] = [...predefined]

export function getAllTemplates(): EmailTemplate[] {
  return [...store]
}

export function getTemplateById(id: string): EmailTemplate | undefined {
  return store.find(t => t.id === id)
}

export function upsertTemplate(template: EmailTemplate): EmailTemplate {
  const idx = store.findIndex(t => t.id === template.id)
  const updated = { ...template, updatedAt: new Date().toISOString() }
  if (idx >= 0) {
    store[idx] = updated
  } else {
    store = [...store, updated]
  }
  return updated
}

export function deleteTemplate(id: string): void {
  store = store.filter(t => t.id !== id)
}

export function createBlankTemplate(): EmailTemplate {
  const now = new Date().toISOString()
  return {
    id: `tpl-${Date.now()}`,
    name: 'Untitled Template',
    description: '',
    eventType: 'custom',
    subject: '',
    recipientList: [],
    templateStyle: { ...DEFAULT_TEMPLATE_STYLE },
    rows: [],
    isPredefined: false,
    createdAt: now,
    updatedAt: now,
  }
}
