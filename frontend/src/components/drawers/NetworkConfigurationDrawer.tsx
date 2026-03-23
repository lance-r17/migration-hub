import { useState, useEffect } from 'react'
import { SectionEditDrawer } from './SectionEditDrawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { StringListEditor } from './StringListEditor'
import type { CurrentInfrastructure } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: CurrentInfrastructure | undefined
  onSave: (data: CurrentInfrastructure) => void
}

export function NetworkConfigurationDrawer({ open, onOpenChange, data, onSave }: Props) {
  const [draft, setDraft] = useState({
    loadBalancerType: '',
    bandwidthRequirements: '',
    hardcodedIps: false,
    privateConnectivity: '',
    vipDnsNames: [] as string[],
    firewallZones: [] as string[],
  })

  useEffect(() => {
    if (open) {
      const n = data?.network
      setDraft({
        loadBalancerType: n?.loadBalancerType ?? '',
        bandwidthRequirements: n?.bandwidthRequirements ?? '',
        hardcodedIps: n?.hardcodedIps ?? false,
        privateConnectivity: n?.privateConnectivity ?? '',
        vipDnsNames: n?.vipDnsNames ?? [],
        firewallZones: n?.firewallZones ?? [],
      })
    }
  }, [open, data])

  function handleSave() {
    onSave({
      resources: data?.resources ?? [],
      network: {
        loadBalancerType: draft.loadBalancerType || undefined,
        bandwidthRequirements: draft.bandwidthRequirements || undefined,
        hardcodedIps: draft.hardcodedIps,
        privateConnectivity: draft.privateConnectivity || undefined,
        vipDnsNames: draft.vipDnsNames.length ? draft.vipDnsNames : undefined,
        firewallZones: draft.firewallZones.length ? draft.firewallZones : undefined,
      },
    })
    onOpenChange(false)
  }

  return (
    <SectionEditDrawer open={open} onOpenChange={onOpenChange} title="Edit Network Configuration" onSave={handleSave}>
      <div className="space-y-1.5">
        <Label htmlFor="nc-lb">Load Balancer Type</Label>
        <Input
          id="nc-lb"
          value={draft.loadBalancerType}
          onChange={(e) => setDraft(d => ({ ...d, loadBalancerType: e.target.value }))}
          placeholder="e.g. AWS ALB"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nc-bw">Bandwidth Requirements</Label>
        <Input
          id="nc-bw"
          value={draft.bandwidthRequirements}
          onChange={(e) => setDraft(d => ({ ...d, bandwidthRequirements: e.target.value }))}
          placeholder="e.g. 1 Gbps"
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="nc-ips"
          checked={draft.hardcodedIps}
          onCheckedChange={(checked) => setDraft(d => ({ ...d, hardcodedIps: !!checked }))}
        />
        <Label htmlFor="nc-ips" className="cursor-pointer">Hardcoded IPs?</Label>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nc-priv">Private Connectivity</Label>
        <Input
          id="nc-priv"
          value={draft.privateConnectivity}
          onChange={(e) => setDraft(d => ({ ...d, privateConnectivity: e.target.value }))}
          placeholder="e.g. AWS Direct Connect"
        />
      </div>
      <StringListEditor
        label="VIP / DNS Names"
        values={draft.vipDnsNames}
        onChange={(v) => setDraft(d => ({ ...d, vipDnsNames: v }))}
        placeholder="e.g. app.internal.company.com"
      />
      <StringListEditor
        label="Firewall Zones"
        values={draft.firewallZones}
        onChange={(v) => setDraft(d => ({ ...d, firewallZones: v }))}
        placeholder="e.g. DMZ, PROD"
      />
    </SectionEditDrawer>
  )
}
