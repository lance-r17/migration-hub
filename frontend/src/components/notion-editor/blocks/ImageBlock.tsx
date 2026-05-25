import { useRef } from 'react'
import { Image } from 'lucide-react'
import { Editable } from '../Editable'
import type { Block } from '../model'
import type { BlockRendererProps } from './types'

export function ImageBlock({ block, onChange, readOnly }: BlockRendererProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const b = block as Extract<Block, { type: 'image' }>
  const onFile = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onChange({ src: reader.result as string })
    reader.readAsDataURL(file)
  }

  return (
    <div className="rounded-md overflow-hidden bg-muted border border-border">
      {b.src ? (
        <img className="block w-full h-auto max-h-[480px] object-cover" src={b.src} alt="" />
      ) : !readOnly ? (
        <div
          className="flex gap-3 items-center px-4 py-3.5 text-sm text-muted-foreground cursor-pointer hover:bg-border hover:text-foreground"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]) }}
        >
          <Image size={18} />
          <span>Click to upload an image, or drag &amp; drop</span>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      ) : (
        <div className="flex gap-3 items-center px-4 py-3.5 text-sm text-muted-foreground">
          <Image size={18} />
          <span>No image</span>
        </div>
      )}
      {b.src && (
        <Editable
          className="px-1 py-1.5 text-[13px] text-muted-foreground"
          value={b.caption}
          onChange={(html) => onChange({ caption: html })}
          placeholder="Write a caption…"
          readOnly={readOnly}
        />
      )}
    </div>
  )
}
