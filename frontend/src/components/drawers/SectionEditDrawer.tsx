import type { ReactNode } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SectionEditDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  onSave: () => void
  saveDisabled?: boolean
  children: ReactNode
  widthClass?: string
  footerExtra?: ReactNode
}

export function SectionEditDrawer({
  open,
  onOpenChange,
  title,
  description,
  onSave,
  saveDisabled,
  children,
  widthClass = 'w-[600px] sm:!max-w-[600px]',
  footerExtra,
}: SectionEditDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(widthClass, 'flex flex-col p-0 gap-0')}
        showCloseButton={false}
      >
        <SheetHeader className="border-b px-6 py-4 pr-12">
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {children}
        </div>
        <SheetFooter className="border-t px-6 py-4 flex flex-row gap-2 justify-end">
          {footerExtra}
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
          <Button onClick={onSave} disabled={saveDisabled}>Save Changes</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
