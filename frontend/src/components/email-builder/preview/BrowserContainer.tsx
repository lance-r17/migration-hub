import { Monitor, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Viewport = 'desktop' | 'mobile'

interface Props {
  viewport: Viewport
  onViewportChange: (v: Viewport) => void
  html: string
}

const VIEWPORT_WIDTHS: Record<Viewport, number> = {
  desktop: 1100,
  mobile: 390,
}

function PhoneFrame({ html }: { html: string }) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Ambient ground shadow */}
      <div style={{
        position: 'absolute',
        left: '15%',
        right: '15%',
        bottom: '-28px',
        height: '48px',
        background: 'rgba(0,0,0,0.28)',
        filter: 'blur(22px)',
        borderRadius: '50%',
      }} />

      {/* Hardware buttons — left side */}
      {/* Mute toggle */}
      <div style={{
        position: 'absolute', left: '-4px', top: '82px',
        width: '4px', height: '22px',
        background: 'linear-gradient(to right, #161616, #252525)',
        borderRadius: '3px 0 0 3px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
      }} />
      {/* Volume up */}
      <div style={{
        position: 'absolute', left: '-4px', top: '114px',
        width: '4px', height: '34px',
        background: 'linear-gradient(to right, #161616, #252525)',
        borderRadius: '3px 0 0 3px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
      }} />
      {/* Volume down */}
      <div style={{
        position: 'absolute', left: '-4px', top: '158px',
        width: '4px', height: '34px',
        background: 'linear-gradient(to right, #161616, #252525)',
        borderRadius: '3px 0 0 3px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
      }} />

      {/* Hardware buttons — right side (power) */}
      <div style={{
        position: 'absolute', right: '-4px', top: '128px',
        width: '4px', height: '68px',
        background: 'linear-gradient(to left, #161616, #252525)',
        borderRadius: '0 3px 3px 0',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
      }} />

      {/* Phone body */}
      <div style={{
        position: 'relative',
        width: '393px',
        borderRadius: '56px',
        padding: '11px',
        background: 'linear-gradient(155deg, #2e2e2e 0%, #1c1c1c 45%, #101010 100%)',
        boxShadow: [
          '0 0 0 1px rgba(255,255,255,0.10)',
          '0 0 0 1.5px rgba(0,0,0,0.8)',
          'inset 0 1.5px 0 rgba(255,255,255,0.14)',
          'inset 0 -1px 0 rgba(0,0,0,0.6)',
          '0 50px 100px rgba(0,0,0,0.6)',
          '0 20px 40px rgba(0,0,0,0.4)',
          '0 6px 12px rgba(0,0,0,0.3)',
        ].join(', '),
      }}>

        {/* Screen */}
        <div style={{
          borderRadius: '46px',
          overflow: 'hidden',
          background: '#000',
          position: 'relative',
        }}>

          {/* Status bar */}
          <div style={{
            height: '52px',
            background: '#000',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            paddingBottom: '10px',
            paddingLeft: '28px',
            paddingRight: '26px',
          }}>
            <span style={{
              color: '#fff',
              fontSize: '15px',
              fontWeight: 600,
              letterSpacing: '-0.4px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
            }}>
              9:41
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {/* Signal bars */}
              <svg width="17" height="12" viewBox="0 0 17 12" fill="white">
                <rect x="0" y="6.5" width="3" height="5.5" rx="0.8" opacity="0.38" />
                <rect x="4.5" y="4" width="3" height="8" rx="0.8" opacity="0.6" />
                <rect x="9" y="2" width="3" height="10" rx="0.8" opacity="0.85" />
                <rect x="13.5" y="0" width="3" height="12" rx="0.8" />
              </svg>
              {/* Wi-Fi */}
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                <circle cx="8" cy="11" r="1.5" fill="white" />
                <path d="M4.6 7.4a4.8 4.8 0 0 1 6.8 0" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M1.5 4.2A9 9 0 0 1 14.5 4.2" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.38" />
              </svg>
              {/* Battery */}
              <svg width="26" height="13" viewBox="0 0 26 13" fill="none">
                <rect x="0.5" y="0.5" width="22" height="12" rx="2.8" stroke="white" strokeOpacity="0.55" />
                <rect x="2" y="2" width="17" height="9" rx="1.6" fill="white" />
                <path d="M24 4.8v3.4a1.8 1.8 0 0 0 0-3.4z" fill="white" fillOpacity="0.45" />
              </svg>
            </div>
          </div>

          {/* Dynamic Island */}
          <div style={{
            position: 'absolute',
            top: '11px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '126px',
            height: '36px',
            background: '#000',
            borderRadius: '100px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: [
              'inset 0 0 0 0.5px rgba(255,255,255,0.06)',
              '0 0 0 1px rgba(0,0,0,0.8)',
            ].join(', '),
            zIndex: 10,
          }}>
            {/* Camera lens */}
            <div style={{
              width: '12px', height: '12px', borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 35%, #1a1a28, #0a0a14)',
              boxShadow: 'inset 0 0 0 2px #1e2030, 0 0 0 0.5px #2244aa33',
            }} />
            {/* FaceID sensor */}
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: '#080810',
              boxShadow: 'inset 0 1px 4px rgba(60,120,255,0.4)',
            }} />
          </div>

          {/* Email content iframe */}
          <iframe
            srcDoc={html}
            title="Email Preview"
            className="border-0"
            style={{ width: '371px', height: '660px', display: 'block' }}
            sandbox="allow-same-origin"
          />

          {/* Home indicator bar */}
          <div style={{
            height: '34px',
            background: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              width: '134px',
              height: '5px',
              background: 'rgba(255,255,255,0.28)',
              borderRadius: '100px',
            }} />
          </div>

          {/* Subtle glass sheen over the whole screen */}
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '46px',
            background: 'linear-gradient(150deg, rgba(255,255,255,0.045) 0%, transparent 35%)',
            pointerEvents: 'none',
          }} />
        </div>
      </div>
    </div>
  )
}

export function BrowserContainer({ viewport, onViewportChange, html }: Props) {
  const width = VIEWPORT_WIDTHS[viewport]

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Viewport toggle */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
        <Button
          variant={viewport === 'desktop' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => onViewportChange('desktop')}
        >
          <Monitor className="size-3.5" /> Desktop
        </Button>
        <Button
          variant={viewport === 'mobile' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => onViewportChange('mobile')}
        >
          <Smartphone className="size-3.5" /> Mobile
        </Button>
      </div>

      {viewport === 'desktop' ? (
        /* Browser chrome */
        <div
          className="rounded-xl border border-border shadow-xl overflow-hidden bg-background transition-all duration-300"
          style={{ width: Math.min(width, window.innerWidth - 48) }}
        >
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/60 border-b border-border">
            <div className="flex gap-1.5">
              <div className="size-2.5 rounded-full bg-red-400/70" />
              <div className="size-2.5 rounded-full bg-amber-400/70" />
              <div className="size-2.5 rounded-full bg-green-400/70" />
            </div>
            <div className="flex-1 bg-background/80 rounded-md px-3 py-1 text-xs text-muted-foreground border border-border/50">
              mail.company.com
            </div>
          </div>
          <iframe
            srcDoc={html}
            title="Email Preview"
            className="w-full border-0"
            style={{ height: '600px' }}
            sandbox="allow-same-origin"
          />
        </div>
      ) : (
        <PhoneFrame html={html} />
      )}
    </div>
  )
}
