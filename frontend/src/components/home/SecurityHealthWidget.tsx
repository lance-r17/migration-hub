import { ProgressBar } from '@/components/shared/ProgressBar'

export function SecurityHealthWidget() {
  return (
    <div className="bg-muted/50 p-6 rounded-xl flex flex-col justify-between">
      <div>
        <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-widest">Security Health</h3>
        <div className="p-4 bg-card rounded-lg shadow-sm border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-muted-foreground">SOC2 Readiness</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">94%</span>
          </div>
          <ProgressBar value={94} variant="tertiary" height="h-2" />
        </div>
      </div>
      <div className="mt-8">
        <p className="text-[10px] text-muted-foreground italic mb-4">
          "Your migration projects are currently 100% compliant with NIST standards."
        </p>
        <button className="w-full py-2 bg-card text-foreground text-xs font-bold rounded-lg border border-border hover:bg-muted transition-colors">
          View Compliance Report
        </button>
      </div>
    </div>
  )
}
