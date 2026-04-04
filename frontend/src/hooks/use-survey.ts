import { useState, useEffect, useCallback } from 'react'
import { getSurveyConfig, saveSurveyConfig, getSurveyFieldDefs } from '@/services/surveyService'
import type { SurveyConfig, SurveyFieldDef } from '@/types/survey'

export function useSurveyConfig() {
  const [surveyConfig, setSurveyConfig] = useState<SurveyConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    getSurveyConfig().then(cfg => {
      if (!cancelled) {
        setSurveyConfig(cfg)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  const save = useCallback(async (config: SurveyConfig) => {
    setSaving(true)
    try {
      const saved = await saveSurveyConfig(config)
      setSurveyConfig(saved)
      return saved
    } finally {
      setSaving(false)
    }
  }, [])

  return { surveyConfig, loading, saving, save }
}

export function useSurveyFieldDefs() {
  const [fieldDefs, setFieldDefs] = useState<SurveyFieldDef[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getSurveyFieldDefs().then(defs => {
      if (!cancelled) { setFieldDefs(defs); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [])

  const getFieldById = useCallback(
    (id: string) => fieldDefs.find(f => f.id === id),
    [fieldDefs]
  )

  const getFieldsBySection = useCallback(() => {
    const sections: Record<string, SurveyFieldDef[]> = {}
    for (const def of fieldDefs) {
      if (!sections[def.sectionLabel]) sections[def.sectionLabel] = []
      sections[def.sectionLabel]!.push(def)
    }
    return sections
  }, [fieldDefs])

  return { fieldDefs, loading, getFieldById, getFieldsBySection }
}
