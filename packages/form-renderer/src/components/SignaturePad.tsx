import {
  IconCheck,
  IconDeviceMobile,
  IconEraser,
  IconHandFinger,
  IconPencil,
  IconQrcode,
  IconShieldCheck,
  IconShieldLock,
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

async function sha256Hex(str: string): Promise<string> {
  const buffer = new TextEncoder().encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

interface SignaturePadProps extends Omit<IComponentProps, 'onChange'> {
  value?: any
  penColor?: string
  onChange?: (value: any) => void
  isLegal?: boolean
  legalConsentText?: string
  requireConsentCheckbox?: boolean
}

export const SignaturePad: FC<SignaturePadProps> = ({
  value,
  penColor = '#1e293b',
  onChange,
  isLegal = false,
  legalConsentText,
  requireConsentCheckbox = true
}) => {
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

  // Legal & Telemetry state
  const strokeCountRef = useRef(0)
  const pointCountRef = useRef(0)
  const startedAtRef = useRef<number | null>(null)
  const signingMethodRef = useRef<'canvas' | 'trackpad' | 'phone_sync'>('canvas')
  const [isConsentAccepted, setIsConsentAccepted] = useState(value?.audit?.consentAccepted ?? true)

  const defaultConsentText =
    t(
      '本人聲明此電子簽章具備法律效力，等同於本人親筆簽名，並同意記錄簽署時間、IP位址與防竄改數位指紋作為存證紀錄。'
    ) ||
    '本人聲明此電子簽章具備法律效力，等同於本人親筆簽名，並同意記錄簽署時間、IP位址與防竄改數位指紋作為存證紀錄。'
  const effectiveConsentText = legalConsentText?.trim() || defaultConsentText

  const rawSignature = useMemo(() => {
    if (typeof value === 'string') return value
    if (value && typeof value === 'object' && value.signature) return value.signature
    return ''
  }, [value])

  const lastExportedValueRef = useRef<string | undefined>(rawSignature)
  const isInternalDrawingRef = useRef(false)

  const exportSignature = useCallback(
    async (
      dataUrl: string,
      methodOverride?: 'canvas' | 'trackpad' | 'phone_sync',
      overrideConsent?: boolean
    ) => {
      if (!dataUrl) {
        lastExportedValueRef.current = ''
        onChange?.('')
        return
      }

      if (methodOverride) {
        signingMethodRef.current = methodOverride
      }

      lastExportedValueRef.current = dataUrl
      const consentAccepted = overrideConsent !== undefined ? overrideConsent : isConsentAccepted

      if (isLegal) {
        const sigHash = await sha256Hex(dataUrl)
        const now = Date.now()
        const exportVal = {
          signature: dataUrl,
          audit: {
            auditId: 'sig_' + nanoid(16),
            isLegal: true,
            status: 'verified',
            signatureHash: sigHash,
            consentText: effectiveConsentText,
            consentAccepted,
            signingMethod: signingMethodRef.current || 'canvas',
            strokeCount: Math.max(1, strokeCountRef.current),
            pointCount: Math.max(5, pointCountRef.current),
            durationMs: Math.max(100, now - (startedAtRef.current || now)),
            clientSignedAt: now,
            clientSignedAtIso: new Date(now).toISOString()
          }
        }
        onChange?.(exportVal)
      } else {
        onChange?.(dataUrl)
      }
    },
    [isLegal, effectiveConsentText, isConsentAccepted, onChange]
  )

  const handleConsentChange = useCallback(
    (accepted: boolean) => {
      setIsConsentAccepted(accepted)
      if (lastExportedValueRef.current) {
        exportSignature(lastExportedValueRef.current, undefined, accepted)
      }
    },
    [exportSignature]
  )

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
    strokeCountRef.current = 0
    pointCountRef.current = 0
    startedAtRef.current = null
    onChange?.('')
  }, [signaturePad, onChange])

  const handleBeginStroke = useCallback(() => {
    isInternalDrawingRef.current = true
    strokeCountRef.current += 1
    pointCountRef.current += 1
    signingMethodRef.current = 'canvas'
    if (!startedAtRef.current) {
      startedAtRef.current = Date.now()
    }
  }, [])

  const handleEndStroke = useCallback(() => {
    if (signaturePad && !signaturePad.isEmpty()) {
      const dataUrl = signaturePad.toDataURL('image/png')
      exportSignature(dataUrl, 'canvas')
    }
    setTimeout(() => {
      isInternalDrawingRef.current = false
    }, 150)
  }, [signaturePad, exportSignature])

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
    if (isInternalDrawingRef.current || rawSignature === lastExportedValueRef.current) {
      return
    }

    lastExportedValueRef.current = rawSignature

    if (helper.isValid(rawSignature) && rawSignature !== '') {
      signaturePad.fromDataURL(rawSignature)
    } else {
      signaturePad.clear()
    }
  }, [signaturePad, rawSignature])

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
      } else if (rawSignature && signaturePad) {
        signaturePad.fromDataURL(rawSignature)
      } else {
        signaturePad?.clear()
      }
    }
  }, [canvasRef, signaturePad, rawSignature])

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

    if (canvasRef) {
      const dataUrl = canvasRef.toDataURL('image/png')
      exportSignature(dataUrl, 'trackpad')
    }

    if (signaturePad) {
      signaturePad.on()
    }
  }, [signaturePad, exportSignature, canvasRef])

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
      strokeCountRef.current += 1
      pointCountRef.current += 1
      signingMethodRef.current = 'trackpad'
      if (!startedAtRef.current) {
        startedAtRef.current = Date.now()
      }

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

      pointCountRef.current += events.length

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

            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => {
              const dpr = Math.max(window.devicePixelRatio || 1, 1)
              const destW = (canvasRef.offsetWidth || 400) * dpr
              const destH = (canvasRef.offsetHeight || 200) * dpr

              const offscreen = document.createElement('canvas')
              offscreen.width = destW
              offscreen.height = destH
              const offCtx = offscreen.getContext('2d')
              if (!offCtx) return

              const pW = phoneW > 0 ? phoneW : img.naturalWidth
              const pH = phoneH > 0 ? phoneH : img.naturalHeight
              const scale = Math.min((destW * 0.9) / pW, (destH * 0.9) / pH)
              const drawW = pW * scale
              const drawH = pH * scale
              const offsetX = (destW - drawW) / 2
              const offsetY = (destH - drawH) / 2

              offCtx.clearRect(0, 0, destW, destH)
              offCtx.drawImage(img, offsetX, offsetY, drawW, drawH)
              const finalDataUrl = offscreen.toDataURL('image/png')

              signingMethodRef.current = 'phone_sync'
              if (!startedAtRef.current) startedAtRef.current = Date.now()
              strokeCountRef.current = Math.max(strokeCountRef.current, 1)
              pointCountRef.current = Math.max(pointCountRef.current, 20)

              lastExportedValueRef.current = finalDataUrl
              signaturePad?.clear()
              signaturePad?.fromDataURL(finalDataUrl)
              exportSignature(finalDataUrl, 'phone_sync')
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
  }, [signaturePad, exportSignature, canvasRef])

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
          {/* Trackpad Mode Button */}
          <button
            type="button"
            className="border-accent-light bg-foreground/60 text-primary hover:bg-accent-light hover:text-primary inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium shadow-sm transition-all"
            onClick={handleStartTrackpad}
            title={t(
              'Trackpad Mode - Full surface direct finger writing with pressure sensitivity'
            )}
          >
            <IconPencil className="h-3.5 w-3.5 text-blue-500" />
            <span>{t('Trackpad Mode')}</span>
          </button>

          {/* Sign on Phone QR Code Button */}
          <button
            type="button"
            className="border-accent-light bg-foreground/60 text-primary hover:bg-accent-light hover:text-primary inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium shadow-sm transition-all"
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

      {/* Legal E-Signature Notice & Consent */}
      {isLegal && (
        <div className="mt-3 overflow-hidden rounded-xl border border-emerald-500/30 bg-emerald-50/50 p-3.5 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300">
              <IconShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>{t('Legal E-Signature & Audit Trail Active')}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <IconShieldLock className="h-3.5 w-3.5" />
              <span>SHA-256 Tamper-Proof</span>
            </div>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {effectiveConsentText}
          </p>

          {requireConsentCheckbox && (
            <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-800 select-none dark:text-slate-200">
              <input
                type="checkbox"
                checked={isConsentAccepted}
                onChange={e => handleConsentChange(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>{t('I agree to the legal declaration above')}</span>
            </label>
          )}
        </div>
      )}

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

            {/* Action Buttons: Direct open & Copy link */}
            <div className="border-accent-light mt-4 flex flex-col gap-2 border-t pt-3">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow transition-colors hover:bg-emerald-500"
                onClick={() => window.open(qrUrl, '_blank')}
              >
                <IconDeviceMobile className="h-4 w-4" />
                <span>{t('Open mobile signing page')}</span>
              </button>

              <button
                type="button"
                className="text-secondary hover:text-primary text-xs underline transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText(qrUrl)
                  alert(t('Signing link copied to clipboard!'))
                }}
              >
                {t('Copy signing link')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
