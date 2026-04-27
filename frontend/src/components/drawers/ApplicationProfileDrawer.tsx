import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import { SectionEditDrawer } from './SectionEditDrawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import type { ApplicationOverview, ApplicationTier, MigrationStrategy } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: ApplicationOverview | undefined
  onSave: (data: ApplicationOverview) => void
}

const textareaClass =
  'min-h-[80px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-y dark:bg-input/30'

const sectionLabel = 'text-xs font-semibold uppercase text-muted-foreground tracking-wide pt-2'

const CLASSIFICATION_OPTIONS = [
  { value: 'IBS', label: 'IBS - Important Business Service' },
  { value: 'BPS', label: 'BPS - Business Prioritised Service' },
] as const

export function ApplicationProfileDrawer({ open, onOpenChange, data, onSave }: Props) {
  const [draft, setDraft] = useState({
    applicationName: '',
    shortName: '',
    baId: '',
    applicationTier: '' as ApplicationTier | '',
    userBaseType: 'Internal' as 'Internal' | 'External' | 'Both',
    userBaseCount: '',
    businessFunction: '',
    systemImportanceClassification: [] as ('IBS' | 'BPS')[],
    iitaApplicability: '' as 'true' | 'false' | '',
    softwareOrigin: '' as 'in-house' | '3rd party' | '',
    migrationStrategy: '' as MigrationStrategy | '',
    serviceLine: '',
  })

  const showIita = draft.systemImportanceClassification.includes('IBS')

  useEffect(() => {
    if (open) {
      setDraft({
        applicationName: data?.applicationName ?? '',
        shortName: data?.shortName ?? '',
        baId: data?.baId ?? '',
        applicationTier: data?.applicationTier ?? '',
        userBaseType: data?.userBase?.type ?? 'Internal',
        userBaseCount: data?.userBase?.count ?? '',
        businessFunction: data?.businessFunction ?? '',
        systemImportanceClassification: data?.systemImportanceClassification ?? [],
        iitaApplicability: data?.iitaApplicability != null ? (data.iitaApplicability ? 'true' : 'false') : '',
        softwareOrigin: data?.softwareOrigin ?? '',
        migrationStrategy: data?.migrationStrategy ?? '',
        serviceLine: data?.serviceLine ?? '',
      })
    }
  }, [open, data])

  function toggleClassification(value: 'IBS' | 'BPS') {
    setDraft(d => {
      const next = d.systemImportanceClassification.includes(value)
        ? d.systemImportanceClassification.filter(v => v !== value)
        : [...d.systemImportanceClassification, value]
      // Clear IITA if IBS is removed
      if (!next.includes('IBS')) {
        return { ...d, systemImportanceClassification: next, iitaApplicability: '' }
      }
      return { ...d, systemImportanceClassification: next }
    })
  }

  function handleSave() {
    onSave({
      ...data,
      applicationName: draft.applicationName,
      shortName: draft.shortName || undefined,
      baId: draft.baId || undefined,
      applicationTier: (draft.applicationTier as ApplicationTier) || undefined,
      userBase: { type: draft.userBaseType, count: draft.userBaseCount || undefined },
      businessFunction: draft.businessFunction || undefined,
      systemImportanceClassification: draft.systemImportanceClassification.length > 0 ? draft.systemImportanceClassification : undefined,
      iitaApplicability: showIita && draft.iitaApplicability !== '' ? draft.iitaApplicability === 'true' : undefined,
      softwareOrigin: (draft.softwareOrigin as 'in-house' | '3rd party') || undefined,
      migrationStrategy: (draft.migrationStrategy as MigrationStrategy) || undefined,
      serviceLine: draft.serviceLine || undefined,
    })
    onOpenChange(false)
  }

  return (
    <SectionEditDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Application Profile"
      onSave={handleSave}
    >
      <p className={sectionLabel}>Application Details</p>

      <div className="space-y-1.5">
        <Label htmlFor="ap-name">Application Name *</Label>
        <Input
          id="ap-name"
          value={draft.applicationName}
          onChange={(e) => setDraft(d => ({ ...d, applicationName: e.target.value }))}
          placeholder="Application name"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ap-short">Short Name</Label>
        <Input
          id="ap-short"
          value={draft.shortName}
          onChange={(e) => setDraft(d => ({ ...d, shortName: e.target.value }))}
          placeholder="Short name or alias"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ap-ba">BA ID</Label>
          <Input
            id="ap-ba"
            value={draft.baId}
            onChange={(e) => setDraft(d => ({ ...d, baId: e.target.value }))}
            placeholder="BA ID"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Application Tier</Label>
          <Select
            value={draft.applicationTier}
            onValueChange={(v) => setDraft(d => ({ ...d, applicationTier: v as ApplicationTier }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="T0">T0 - Critical</SelectItem>
              <SelectItem value="T1">T1 - Important</SelectItem>
              <SelectItem value="T2">T2 - Standard</SelectItem>
              <SelectItem value="T3">T3 - Basic</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className={sectionLabel}>User Base</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>User Type</Label>
          <Select
            value={draft.userBaseType}
            onValueChange={(v) => setDraft(d => ({ ...d, userBaseType: v as 'Internal' | 'External' | 'Both' }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Internal">Internal</SelectItem>
              <SelectItem value="External">External</SelectItem>
              <SelectItem value="Both">Both</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ap-ub-count">User Count</Label>
          <Input
            id="ap-ub-count"
            value={draft.userBaseCount}
            onChange={(e) => setDraft(d => ({ ...d, userBaseCount: e.target.value }))}
            placeholder="e.g. ~5,000"
          />
        </div>
      </div>

      <p className={sectionLabel}>Business Function</p>

      <div className="space-y-1.5">
        <Label htmlFor="ap-biz">Description</Label>
        <textarea
          id="ap-biz"
          className={textareaClass}
          value={draft.businessFunction}
          onChange={(e) => setDraft(d => ({ ...d, businessFunction: e.target.value }))}
          placeholder="Describe the business function of this application"
        />
      </div>

      <p className={sectionLabel}>Service Line</p>

      <div className="space-y-1.5">
        <Label htmlFor="ap-service-line">Service Line</Label>
        <Input
          id="ap-service-line"
          value={draft.serviceLine}
          onChange={(e) => setDraft(d => ({ ...d, serviceLine: e.target.value }))}
          placeholder="e.g. Finance & Operations"
        />
      </div>

      <p className={sectionLabel}>Migration Classification</p>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>System Importance Classification *</Label>
          <div className="flex flex-col gap-2 pt-1">
            {CLASSIFICATION_OPTIONS.map((opt) => {
              const isSelected = draft.systemImportanceClassification.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleClassification(opt.value)}
                  className={
                    'flex items-center w-full px-3 py-2 rounded-md border-2 text-left transition-all ' +
                    (isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground')
                  }
                >
                  <span className={
                    'flex-shrink-0 flex items-center justify-center w-5 h-5 text-xs font-bold mr-3 border rounded transition-colors ' +
                    (isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground')
                  }>
                    {isSelected && <Check size={12} />}
                  </span>
                  <span className="text-sm">{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {showIita && (
          <div className="space-y-1.5">
            <Label>IITA (Important IT Asset) Applicability *</Label>
            <Select
              value={draft.iitaApplicability}
              onValueChange={(v) => setDraft(d => ({ ...d, iitaApplicability: v as 'true' | 'false' }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Software Origin</Label>
            <Select
              value={draft.softwareOrigin}
              onValueChange={(v) => setDraft(d => ({ ...d, softwareOrigin: v as 'in-house' | '3rd party' }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select origin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in-house">In-house</SelectItem>
                <SelectItem value="3rd party">3rd party</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Migration Strategy *</Label>
            <Select
              value={draft.migrationStrategy}
              onValueChange={(v) => setDraft(d => ({ ...d, migrationStrategy: v as MigrationStrategy }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select strategy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Lift & Shift">Lift &amp; Shift</SelectItem>
                <SelectItem value="Refactor">Refactor</SelectItem>
                <SelectItem value="Deboard">Deboard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </SectionEditDrawer>
  )
}
