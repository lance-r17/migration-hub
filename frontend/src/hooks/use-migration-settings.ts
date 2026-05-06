import { useState, useEffect, useCallback } from 'react'
import { getMigrationSettings, saveMigrationSettings } from '@/services/migrationSettings'
import type { MigrationSettings } from '@/types/settings'

export function useMigrationSettings() {
  const [settings, setSettings] = useState<MigrationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    getMigrationSettings()
      .then((cfg) => {
        if (!cancelled) {
          setSettings(cfg)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const save = useCallback(async (config: MigrationSettings) => {
    setSaving(true)
    try {
      const saved = await saveMigrationSettings(config)
      setSettings(saved)
      return saved
    } finally {
      setSaving(false)
    }
  }, [])

  return { settings, loading, saving, save }
}
