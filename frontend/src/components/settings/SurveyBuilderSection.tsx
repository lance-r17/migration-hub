import { useState, useEffect } from 'react'
import { ClipboardList, Layers } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSurveyConfig } from '@/hooks/use-survey'
import { ApplicationSurveyTab } from './survey-builder/ApplicationSurveyTab'
import { ResourceQuestionsTab } from './survey-builder/ResourceQuestionsTab'


// ─── Main export ──────────────────────────────────────────────────────────────

export function SurveyBuilderSection() {
  const { surveyConfig, loading, saving, save } = useSurveyConfig()
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    if (surveyConfig) {
      setIsActive(surveyConfig.isActive)
    }
  }, [surveyConfig])

  return (
    <div className="space-y-6">
      <Tabs defaultValue="application">
        <div className="flex items-center justify-between border-b pb-1">
          <TabsList>
            <TabsTrigger value="application" className="gap-1.5">
              <ClipboardList size={14} />
              Application Survey
            </TabsTrigger>
            <TabsTrigger value="resource" className="gap-1.5">
              <Layers size={14} />
              Resource Questions
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2.5 pb-2">
            <span className="text-sm font-medium text-muted-foreground mr-1">Survey active</span>
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
              id="survey-active"
            />
          </div>
        </div>

        <TabsContent value="application" className="mt-6">
          <ApplicationSurveyTab
            isActive={isActive}
            surveyConfig={surveyConfig}
            loading={loading}
            saving={saving}
            save={save}
          />
        </TabsContent>
        <TabsContent value="resource" className="mt-6">
          <ResourceQuestionsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
