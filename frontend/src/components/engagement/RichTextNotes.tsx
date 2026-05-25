import { useState } from 'react'
import { RichTextEditor } from '@/components/email-builder/builder/canvas/RichTextEditor'

interface Props {
  html: string
  onChange: (html: string) => void
}

export function RichTextNotes({ html, onChange }: Props) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <RichTextEditor
        html={html}
        onChange={onChange}
        onClose={() => setEditing(false)}
      />
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm cursor-text hover:border-muted-foreground/50 transition-colors"
      dangerouslySetInnerHTML={{
        __html: html || '<p class="text-muted-foreground">Click to add notes...</p>',
      }}
    />
  )
}
