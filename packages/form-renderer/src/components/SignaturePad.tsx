import {
  IconCheck,
  IconDeviceMobile,
  IconEraser,
  IconHandFinger,
  IconPencil,
  IconQrcode,
  IconX
} from '@tabler/icons-react'
import { QRCodeSVG } from 'qrcode.react'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Signature_pad from 'signature_pad'

import { useTranslation } from '../utils'
import { helper, nanoid } from '@heyform-inc/utils'

import type { IComponentProps } from '../typings'
import { Button } from './Button'

interface SignaturePadProps extends Omit<IComponentProps, 'onChange'> {
  value?: string
  penColor?: string
  onChange?: (value: string) => void
}

export const SignaturePad: FC<SignaturePadProps> = ({ value, penColor = '#1e293b', onChange }) => {
  const { t } = useTranslation()
  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement | null>(null)

  // Trackpad Direct Signing State
  const [isTrackpadActive, setIsTrackpadActive] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentPressure, setCurrentPressure] = useState(1.0)
  const trackpadCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)
  const isPointerDownRef = useRef(false)

  // Phone QR Code Signing State
  const [isQrOpen, setIsQrOpen] = useState(false)
  const [qrSessionId, setQrSessionId] = useState<string>('')
  const [syncSuccess, setSyncSuccess] = useState(false)
  const pollTimerRef = useRef<any>(null)

  const lastExportedValueRef = useRef<string | undefined>(value)
  const isInternalDrawingRef = useRef(false)

  const signaturePad = useMemo(() => {
    if (!canvasRef) return null
    return new Signature_pad(canvasRef, {
      penColor,
      minWidth: 1.5,
      maxWidth: 3.5,
      throttle: 0
    })
  }, [canvasRef, penColor])

  const handleClear = useCallback(() => {
    signaturePad?.clear()
    lastExportedValueRef.current = ''
    onChange?.('')
  }, [signaturePad, onChange])

  const handleBeginStroke = useCallback(() => {
    isInternalDrawingRef.current = true
  }, [])

  const handleEndStroke = useCallback(() => {
    if (signaturePad && !signaturePad.isEmpty()) {
      const dataUrl = signaturePad.toDataURL('image/png')
      lastExportedValueRef.current = dataUrl
      onChange?.(dataUrl)
    }
    setTimeout(() => {
      isInternalDrawingRef.current = false
    }, 150)
  }, [signaturePad, onChange])

  // Register stroke event listeners on signaturePad
  useEffect(() => {
    if (!signaturePad) return
    signaturePad.addEventListener('beginStroke', handleBeginStroke)
    signaturePad.addEventListener('endStroke', handleEndStroke)
    return () => {
      signaturePad.removeEventListener('beginStroke', handleBeginStroke)
      signaturePad.removeEventListener('endStroke', handleEndStroke)
    }
  }, [signaturePad, handleBeginStroke, handleEndStroke])

  // Synchronize external value changes without interrupting user drawing
  useEffect(() => {
    if (!signaturePad) return

    // If currently drawing or if incoming value matches what we exported, do NOT clear/redraw!
    if (isInternalDrawingRef.current || value === lastExportedValueRef.current) {
      return
    }

    lastExportedValueRef.current = value

    if (helper.isValid(value) && value !== '') {
      signaturePad.fromDataURL(value!)
    } else {
      signaturePad.clear()
    }
  }, [signaturePad, value])

  // High-DPI canvas resizing and orientation/layout adjustment
  const resizeCanvas = useCallback(() => {
    if (!canvasRef) return
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    const rect = canvasRef.getBoundingClientRect()
    const width = Math.round(rect.width || canvasRef.offsetWidth)
    const height = Math.round(rect.height || canvasRef.offsetHeight)

    if (width === 0 || height === 0) return

    const targetWidth = Math.round(width * ratio)
    const targetHeight = Math.round(height * ratio)

    if (canvasRef.width !== targetWidth || canvasRef.height !== targetHeight) {
      // Save existing strokes if present
      const data = signaturePad && !signaturePad.isEmpty() ? signaturePad.toData() : null

      canvasRef.width = targetWidth
      canvasRef.height = targetHeight
      const ctx = canvasRef.getContext('2d')
      if (ctx) {
        ctx.scale(ratio, ratio)
      }

      if (data && signaturePad) {
        signaturePad.fromData(data)
      } else if (value && signaturePad) {
        signaturePad.fromDataURL(value)
      } else {
        signaturePad?.clear()
      }
    }
  }, [canvasRef, signaturePad, value])

  // Attach ResizeObserver and resize listeners
  useEffect(() => {
    if (!canvasRef) return

    resizeCanvas()
    const rafId = requestAnimationFrame(resizeCanvas)
    const timerId1 = setTimeout(resizeCanvas, 150)
    const timerId2 = setTimeout(resizeCanvas, 400) // Settle after question entrance transition

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        resizeCanvas()
      })
      if (canvasRef.parentElement) {
        observer.observe(canvasRef.parentElement)
      }
      observer.observe(canvasRef)
    }

    window.addEventListener('resize', resizeCanvas)
    window.addEventListener('orientationchange', resizeCanvas)

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(timerId1)
      clearTimeout(timerId2)
      observer?.disconnect()
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('orientationchange', resizeCanvas)
    }
  }, [canvasRef, resizeCanvas])

  // Prevent mobile gesture conflicts (scrolling, pinch, pull-to-refresh) on canvas
  useEffect(() => {
    const canvas = canvasRef
    if (!canvas) return

    const handleTouch = (e: TouchEvent) => {
      if (e.cancelable) {
        e.preventDefault()
      }
      e.stopPropagation()
    }

    canvas.addEventListener('touchstart', handleTouch, { passive: false })
    canvas.addEventListener('touchmove', handleTouch, { passive: false })

    return () => {
      canvas.removeEventListener('touchstart', handleTouch)
      canvas.removeEventListener('touchmove', handleTouch)
    }
  }, [canvasRef])

  // ──────────────────────────────────────────────────────────
  // Trackpad Mode: Dedicated high-precision drawing canvas
  // with sub-pixel coalesced pointer events, Apple Force Touch,
  // and continuous finger tracking directly on the trackpad.
  // ──────────────────────────────────────────────────────────

  const handleStartTrackpad = useCallback(() => {
    if (!canvasRef) return
    setIsTrackpadActive(true)
    setIsDrawing(false)
    lastPosRef.current = null
    isPointerDownRef.current = false
    signaturePad?.off()
  }, [canvasRef, signaturePad])

  const handleExitTrackpad = useCallback(() => {
    setIsTrackpadActive(false)
    setIsDrawing(false)
    lastPosRef.current = null
    isPointerDownRef.current = false

    // Sync content from trackpad canvas to main canvas if drawn
    if (trackpadCanvasRef.current && canvasRef) {
      const mainCtx = canvasRef.getContext('2d')
      if (mainCtx) {
        mainCtx.clearRect(0, 0, canvasRef.offsetWidth, canvasRef.offsetHeight)
        mainCtx.drawImage(
          trackpadCanvasRef.current,
          0,
          0,
          canvasRef.offsetWidth,
          canvasRef.offsetHeight
        )
      }
    }

    handleEndStroke()

    if (signaturePad) {
      signaturePad.on()
    }
  }, [signaturePad, handleEndStroke, canvasRef])

  // Copy current canvas to trackpad canvas when opened
  useEffect(() => {
    if (isTrackpadActive && trackpadCanvasRef.current && canvasRef) {
      const tCanvas = trackpadCanvasRef.current
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      const rect = tCanvas.getBoundingClientRect()
      tCanvas.width = rect.width * ratio
      tCanvas.height = rect.height * ratio
      const ctx = tCanvas.getContext('2d')
      if (ctx) {
        ctx.scale(ratio, ratio)
        ctx.drawImage(canvasRef, 0, 0, rect.width, rect.height)
      }
    }
  }, [isTrackpadActive, canvasRef])

  // Trackpad drawing handlers with high-frequency coalesced pointer sampling & Force Touch
  const drawLine = useCallback(
    (fromX: number, fromY: number, toX: number, toY: number, pressure: number) => {
      const tCanvas = trackpadCanvasRef.current
      if (!tCanvas) return
      const ctx = tCanvas.getContext('2d')
      if (!ctx) return

      // Modulate line width based on finger pressure (0.5 to 2.5 multiplier)
      const baseWidth = 3.2
      const dynamicWidth = baseWidth * Math.max(0.6, Math.min(2.5, pressure || 1.0))

      ctx.beginPath()
      ctx.strokeStyle = penColor || '#1e293b'
      ctx.lineWidth = dynamicWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.moveTo(fromX, fromY)
      ctx.lineTo(toX, toY)
      ctx.stroke()
    },
    [penColor]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      const tCanvas = trackpadCanvasRef.current
      if (!tCanvas) return

      try {
        tCanvas.setPointerCapture(e.pointerId)
      } catch {}

      const rect = tCanvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      isPointerDownRef.current = true
      setIsDrawing(true)
      lastPosRef.current = { x, y }

      const pressure = (e as any).pressure > 0 ? (e as any).pressure : 1.0
      setCurrentPressure(pressure)

      // Draw initial dot
      drawLine(x, y, x + 0.1, y + 0.1, pressure)
    },
    [drawLine]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isPointerDownRef.current) return
      e.preventDefault()
      const tCanvas = trackpadCanvasRef.current
      if (!tCanvas) return

      const rect = tCanvas.getBoundingClientRect()

      // Use coalesced events to capture all micro-finger positions between frames
      const events: Array<{ clientX: number; clientY: number; pressure?: number }> =
        typeof (e.nativeEvent as any).getCoalescedEvents === 'function'
          ? (e.nativeEvent as any).getCoalescedEvents()
          : [e]

      for (const ev of events) {
        const x = Math.max(0, Math.min(rect.width, ev.clientX - rect.left))
        const y = Math.max(0, Math.min(rect.height, ev.clientY - rect.top))
        const pressure = ev.pressure && ev.pressure > 0 ? ev.pressure : 1.0
        setCurrentPressure(pressure)

        if (lastPosRef.current) {
          drawLine(lastPosRef.current.x, lastPosRef.current.y, x, y, pressure)
        }
        lastPosRef.current = { x, y }
      }
    },
    [drawLine]
  )

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    isPointerDownRef.current = false
    setIsDrawing(false)
    lastPosRef.current = null
    try {
      trackpadCanvasRef.current?.releasePointerCapture(e.pointerId)
    } catch {}
  }, [])

  // Listen to Safari/macOS Force Touch event directly on the canvas
  useEffect(() => {
    const tCanvas = trackpadCanvasRef.current
    if (!isTrackpadActive || !tCanvas) return

    function handleForceChange(e: any) {
      if (typeof e.webkitForce === 'number') {
        const normPressure = Math.max(0.5, Math.min(2.5, e.webkitForce))
        setCurrentPressure(normPressure)
      }
    }

    tCanvas.addEventListener('webkitmouseforcechanged', handleForceChange)
    return () => {
      tCanvas.removeEventListener('webkitmouseforcechanged', handleForceChange)
    }
  }, [isTrackpadActive])

  // ESC key to exit trackpad mode
  useEffect(() => {
    if (!isTrackpadActive) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === 'Escape') {
        handleExitTrackpad()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isTrackpadActive, handleExitTrackpad])

  // Clear trackpad canvas
  const handleClearTrackpad = useCallback(() => {
    const tCanvas = trackpadCanvasRef.current
    if (tCanvas) {
      const ctx = tCanvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, tCanvas.width, tCanvas.height)
      }
    }
    if (canvasRef) {
      const mainCtx = canvasRef.getContext('2d')
      if (mainCtx) {
        mainCtx.clearRect(0, 0, canvasRef.width, canvasRef.height)
      }
    }
    signaturePad?.clear()
    onChange?.('')
  }, [canvasRef, signaturePad, onChange])

  // ──────────────────────────────────────────────────────────
  // Phone QR Code Signing with Proportion-Preserving Sync
  // ──────────────────────────────────────────────────────────

  const handleOpenQrModal = useCallback(() => {
    const id = nanoid(16)
    setQrSessionId(id)
    setSyncSuccess(false)
    setIsQrOpen(true)

    // Notify worker of the session creation — include desktop canvas dimensions
    const desktopW = canvasRef?.offsetWidth || 400
    const desktopH = canvasRef?.offsetHeight || 200
    fetch('/api/signature-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, canvasWidth: desktopW, canvasHeight: desktopH })
    }).catch(() => {})

    // Start polling
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/signature-session/${id}`)
        if (res.ok) {
          const data = (await res.json()) as any
          if (data?.signature && canvasRef) {
            clearInterval(pollTimerRef.current)

            // Proportion-preserving redraw:
            // Calculate scale so the phone's signature fits inside desktop canvas
            // without stretching or changing its aspect ratio
            const phoneW = data.canvasWidth || 0
            const phoneH = data.canvasHeight || 0
            const deskW = canvasRef.offsetWidth
            const deskH = canvasRef.offsetHeight

            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => {
              signaturePad?.clear()
              const ctx = canvasRef.getContext('2d')
              if (ctx) {
                let scale = 1
                if (phoneW > 0 && phoneH > 0) {
                  scale = Math.min(deskW / phoneW, deskH / phoneH)
                } else {
                  scale = Math.min(deskW / img.naturalWidth, deskH / img.naturalHeight)
                }
                const drawW = (phoneW > 0 ? phoneW : img.naturalWidth) * scale
                const drawH = (phoneH > 0 ? phoneH : img.naturalHeight) * scale
                const offsetX = (deskW - drawW) / 2
                const offsetY = (deskH - drawH) / 2

                ctx.clearRect(0, 0, deskW, deskH)
                ctx.drawImage(img, offsetX, offsetY, drawW, drawH)
              }
              onChange?.(canvasRef.toDataURL('image/png'))
            }
            img.src = data.signature

            setSyncSuccess(true)
            setTimeout(() => {
              setIsQrOpen(false)
            }, 1200)
          }
        }
      } catch {}
    }, 1200)
  }, [signaturePad, onChange, canvasRef])

  const handleCloseQrModal = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    setIsQrOpen(false)
  }, [])

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  const qrUrl = useMemo(() => {
    if (typeof window !== 'undefined' && qrSessionId) {
      return `${window.location.origin}/sign/${qrSessionId}`
    }
    return ''
  }, [qrSessionId])

  return (
    <div className="heyform-signature-pad relative w-full">
      {/* Canvas Wrapper */}
      <div className="heyform-signature-wrapper relative touch-none overflow-hidden rounded-lg select-none">
        <canvas
          ref={setCanvasRef}
          className="block h-44 w-full cursor-crosshair touch-none select-none sm:h-48"
          style={{ touchAction: 'none' }}
        />
      </div>

      {/* Trackpad Mode Direct Signing Overlay */}
      {isTrackpadActive && (
        <div className="animate-in fade-in fixed inset-0 z-50 flex flex-col bg-slate-900/90 backdrop-blur-md duration-200">
          {/* Top Bar */}
          <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-3 w-3 rounded-full ${
                  isDrawing ? 'animate-pulse bg-emerald-400' : 'bg-blue-400'
                }`}
              />
              <span className="text-base font-semibold text-white">
                {t('Trackpad Direct Signing Mode')}
              </span>
              <span className="hidden text-xs text-slate-400 md:inline">
                — Touch and write with your finger on your laptop trackpad. Sub-pixel tracking
                active.
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
                onClick={handleClearTrackpad}
              >
                <IconEraser className="mr-1 inline h-3.5 w-3.5" />
                {t('Clear')}
              </button>
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-lg transition-colors hover:bg-blue-500"
                onClick={handleExitTrackpad}
              >
                {t('Done & Save')} (ESC)
              </button>
            </div>
          </div>

          {/* Central Trackpad Surface */}
          <div className="flex flex-1 flex-col items-center justify-center p-6">
            <div className="relative flex h-[60vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border-2 border-dashed border-blue-500/40 bg-slate-800/80 shadow-2xl">
              {/* Guidance watermark */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-slate-600 select-none">
                <IconHandFinger className="mb-3 h-16 w-16 text-slate-700" />
                <p className="text-base font-medium text-slate-500">
                  {t('Glide finger on trackpad to write signature')}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {t('Press down to draw. Supports Force Touch pressure.')}
                </p>
              </div>

              {/* Direct trackpad canvas */}
              <canvas
                ref={trackpadCanvasRef}
                className="relative z-10 h-full w-full cursor-crosshair touch-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
            </div>

            {/* Bottom Status Tips */}
            <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Continuous sub-pixel finger tracking
              </span>
              <span>•</span>
              <span>Pressure: {currentPressure.toFixed(2)}x</span>
              <span>•</span>
              <span>
                Press{' '}
                <kbd className="rounded bg-slate-700 px-1.5 py-0.5 font-mono text-white">ESC</kbd>{' '}
                when finished
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Controls Bar */}
      <div className="heyform-signature-bottom mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-secondary text-xs">{t('Draw your signature above')}</span>

        <div className="flex items-center gap-1.5">
          {/* Trackpad Mode Button - Desktop/laptop only */}
          <button
            type="button"
            className="border-accent-light bg-foreground/60 text-primary hover:bg-accent-light hover:text-primary hidden items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium shadow-sm transition-all sm:inline-flex"
            onClick={handleStartTrackpad}
            title={t(
              'Trackpad Mode - Full surface direct finger writing with pressure sensitivity'
            )}
          >
            <IconPencil className="h-3.5 w-3.5 text-blue-500" />
            <span>{t('Trackpad Mode')}</span>
          </button>

          {/* Sign on Phone QR Code Button - Desktop only */}
          <button
            type="button"
            className="border-accent-light bg-foreground/60 text-primary hover:bg-accent-light hover:text-primary hidden items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium shadow-sm transition-all sm:inline-flex"
            onClick={handleOpenQrModal}
            title={t('Scan with phone camera to sign on touch screen')}
          >
            <IconDeviceMobile className="h-3.5 w-3.5 text-emerald-500" />
            <span>{t('Sign on Phone')}</span>
          </button>

          {/* Clear Button */}
          <button
            type="button"
            className="border-accent-light bg-foreground/60 text-secondary hover:text-error hover:bg-accent-light inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium shadow-sm transition-all"
            onClick={handleClear}
          >
            <IconEraser className="h-3.5 w-3.5" />
            <span>{t('Clear')}</span>
          </button>
        </div>
      </div>

      {/* Sign on Phone QR Code Modal */}
      {isQrOpen && (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200">
          <div className="bg-foreground ring-accent-light border-accent-light relative w-full max-w-sm rounded-2xl border p-6 text-center shadow-2xl ring-1">
            {/* Close Button */}
            <button
              type="button"
              className="text-secondary hover:bg-accent-light hover:text-primary absolute top-4 right-4 rounded-full p-1 transition-colors"
              onClick={handleCloseQrModal}
            >
              <IconX className="h-5 w-5" />
            </button>

            {/* Modal Content */}
            <div className="mb-4">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <IconQrcode className="h-6 w-6" />
              </div>
              <h3 className="text-primary text-base font-semibold">{t('Scan to Sign on Phone')}</h3>
              <p className="text-secondary mt-1 text-xs">
                {t('Scan with phone camera to sign on touch screen')}
              </p>
            </div>

            {/* QR Code Container */}
            <div className="mx-auto flex w-fit items-center justify-center rounded-xl bg-white p-4 shadow-inner ring-1 ring-slate-200">
              {qrUrl ? <QRCodeSVG value={qrUrl} size={190} level="M" /> : null}
            </div>

            {/* Status Indicator */}
            <div className="mt-4 flex items-center justify-center gap-2 text-xs">
              {syncSuccess ? (
                <div className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                  <IconCheck className="h-4 w-4" />
                  <span>{t('Signature synced!')}</span>
                </div>
              ) : (
                <div className="text-secondary flex items-center gap-2">
                  <span className="flex h-2 w-2 animate-ping rounded-full bg-blue-500" />
                  <span>{t('Waiting for signature from phone...')}</span>
                </div>
              )}
            </div>

            {/* Link Copy fallback */}
            <div className="border-accent-light mt-4 border-t pt-3">
              <button
                type="button"
                className="text-secondary hover:text-primary text-xs underline transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText(qrUrl)
                  alert('Signing link copied to clipboard!')
                }}
              >
                Copy signing link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
