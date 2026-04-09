export type LayoutType = 'full' | 'two-col' | 'three-col' | 'left-sidebar' | 'table'

export type ComponentType =
  | 'text'
  | 'hero-image'
  | 'image'
  | 'cta'
  | 'divider'
  | 'spacer'

export type EmailEventType =
  | 'wave_assigned'
  | 'sign_off_required'
  | 'project_signed_off'
  | 'risk_alert'
  | 'cutover_reminder'
  | 'approval_submitted'
  | 'jira_stories_created'
  | 'survey_submitted'
  | 'custom'

export interface TemplateStyle {
  fontFamily: string
  fontSize: number
  textColor: string
  accentColor: string
  backgroundColor: string
  maxWidth: number
  paddingX: number
  paddingY: number
}

export interface ComponentStyle {
  paddingTop?: number
  paddingBottom?: number
  paddingLeft?: number
  paddingRight?: number
  textAlign?: 'left' | 'center' | 'right'
  width?: string
  height?: string
  borderRadius?: number
  backgroundColor?: string
  textColor?: string
}

export interface ComponentContent {
  html?: string
  imageUrl?: string
  altText?: string
  buttonText?: string
  color?: string
  thickness?: number
  spacerHeight?: number
}

export interface ComponentConfig {
  linkUrl?: string
  openInNewTab?: boolean
}

export interface EmailComponent {
  id: string
  type: ComponentType
  style: ComponentStyle
  content: ComponentContent
  config: ComponentConfig
}

export interface EmailColumn {
  id: string
  components: EmailComponent[]
}

export interface TableDataSourceField {
  key: string
  label: string
  example: string
}

export interface TableDataSourceDef {
  key: string
  label: string
  fields: TableDataSourceField[]
}

export interface TableColumnConfig {
  fieldKey: string
  type: 'text' | 'link'
  linkPattern?: string
}

export interface TableConfig {
  numCols: number
  numRows: number
  headerEnabled: boolean
  headerTexts: string[]
  dataSource: string
  columnConfigs?: TableColumnConfig[]
}

export interface RowStyle {
  backgroundColor?: string
}

export interface EmailRow {
  id: string
  layout: LayoutType
  columns: EmailColumn[]
  rowStyle?: RowStyle
  tableConfig?: TableConfig
  columnWidths?: string[]
}

export type RecipientConfig =
  | { type: 'role'; role: string }
  | { type: 'project_field'; field: string }
  | { type: 'static'; email: string }

export interface EmailTemplate {
  id: string
  name: string
  description?: string
  eventType: EmailEventType
  subject: string
  recipientList: RecipientConfig[]
  templateStyle: TemplateStyle
  rows: EmailRow[]
  isPredefined: boolean
  createdAt: string
  updatedAt: string
}

export interface TemplateVariable {
  key: string
  label: string
  category: string
  example: string
}

export const DEFAULT_TEMPLATE_STYLE: TemplateStyle = {
  fontFamily: 'Montserrat',
  fontSize: 14,
  textColor: '#4A3F35',
  accentColor: '#A67C52',
  backgroundColor: '#FFFCF5',
  maxWidth: 600,
  paddingX: 32,
  paddingY: 24,
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  // Project
  { key: 'project.name', label: 'Project Name', category: 'Project', example: 'Alpha Finance' },
  { key: 'project.id', label: 'Project ID', category: 'Project', example: 'PRJ-2024-ALPHA' },
  { key: 'project.status', label: 'Project Status', category: 'Project', example: 'migrating' },
  { key: 'project.applicationTier', label: 'Application Tier', category: 'Project', example: 'T0' },
  // Wave
  { key: 'wave.name', label: 'Wave Name', category: 'Wave', example: 'Wave 3 – Q2 2026' },
  { key: 'wave.cutoverDate', label: 'Cutover Date', category: 'Wave', example: '2026-06-30' },
  { key: 'daysUntilCutover', label: 'Days Until Cutover', category: 'Wave', example: '14' },
  { key: 'wave.jiraEpicKey', label: 'Jira Epic Key', category: 'Wave', example: 'MIG-42' },
  // User
  { key: 'user.name', label: 'User Name', category: 'User', example: 'Jane Smith' },
  { key: 'user.email', label: 'User Email', category: 'User', example: 'jane.smith@company.com' },
  { key: 'approver.name', label: 'Approver Name', category: 'User', example: 'John Doe' },
  // Risk
  { key: 'risk.title', label: 'Risk Title', category: 'Risk', example: 'Database schema incompatibility' },
  { key: 'risk.severity', label: 'Risk Severity', category: 'Risk', example: 'critical' },
  { key: 'risk.severityLabel', label: 'Risk Severity (Capitalised)', category: 'Risk', example: 'Critical' },
  { key: 'risk.description', label: 'Risk Description', category: 'Risk', example: 'The target RDS schema is missing 3 indexes.' },
  // Jira
  { key: 'jiraTicket.key', label: 'Jira Ticket Key', category: 'Jira', example: 'MIG-101' },
  { key: 'jiraTicket.url', label: 'Jira Ticket URL', category: 'Jira', example: 'https://jira.company.com/browse/MIG-101' },
  { key: 'jiraBaseUrl', label: 'Jira Base URL', category: 'Jira', example: 'https://jira.company.com' },
  // Platform
  { key: 'platform.name', label: 'Platform Name', category: 'Platform', example: 'Migration Hub' },
  { key: 'platform.url', label: 'Platform URL', category: 'Platform', example: 'https://migration-hub.company.com' },
]

export const TABLE_DATA_SOURCES: TableDataSourceDef[] = [
  {
    key: 'project.currentInfrastructure.resources',
    label: 'Cloud Resources',
    fields: [
      { key: 'name',           label: 'Resource Name', example: 'web-server-01' },
      { key: 'product',        label: 'Product',        example: 'ecs' },
      { key: 'category',       label: 'Category',       example: 'Database' },
      { key: 'resourceId',     label: 'Resource ID',    example: 'i-abc1234' },
      { key: 'jiraSubtaskKey', label: 'Jira Ticket',    example: 'PROJ-123' },
      { key: 'syncStatus',     label: 'Sync Status',    example: 'synced' },
    ],
  },
]

export const EMAIL_EVENT_LABELS: Record<EmailEventType, string> = {
  wave_assigned: 'Wave Assigned',
  sign_off_required: 'Sign-Off Required',
  project_signed_off: 'Project Signed Off',
  risk_alert: 'Risk Alert',
  cutover_reminder: 'Cutover Reminder',
  approval_submitted: 'Approval Submitted',
  jira_stories_created: 'Jira Stories Created',
  survey_submitted: 'Survey Submitted',
  custom: 'Custom',
}

export const LAYOUT_LABELS: Record<LayoutType, string> = {
  full: 'Full Width',
  'two-col': 'Two Columns',
  'three-col': 'Three Columns',
  'left-sidebar': 'Left Sidebar',
  table: 'Table',
}

export const COMPONENT_LABELS: Record<ComponentType, string> = {
  text: 'Text Block',
  'hero-image': 'Hero Image',
  image: 'Image',
  cta: 'Call to Action',
  divider: 'Divider',
  spacer: 'Spacer',
}
