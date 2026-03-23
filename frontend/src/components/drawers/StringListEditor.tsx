import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface StringListEditorProps {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
}

export function StringListEditor({ label, values, onChange, placeholder }: StringListEditorProps) {
  const [inputValue, setInputValue] = useState('')

  function addItem() {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    onChange([...values, trimmed])
    setInputValue('')
  }

  function removeItem(index: number) {
    onChange(values.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {values.length > 0 && (
        <div className="space-y-1.5">
          {values.map((val, i) => (
            <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-1.5 text-sm">
              <span className="flex-1 break-all">{val}</span>
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={placeholder ?? `Add item…`}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="icon" onClick={addItem}>
          <Plus size={16} />
        </Button>
      </div>
    </div>
  )
}
