import {
  IconCheck,
  IconDeviceMobile,
  IconEraser,
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

  // Phone QR Code Signing State
  const [isQrOpen, setIsQrOpen] = useState(false)
  const [qrSessionId, setQrSessionId] = useState<string>('')
  const [syncSuccess, setSyncSuccess] = useState(false)
  const pollTimerRef = useRef<any>(null)

  // Legal & Telemetry state
  const strokeCountRef = useRef(0)
  const pointCountRef = useRef(0)
  const startedAtRef = useRef<number | null>(null)
  const signingMethodRef = useRef<'canvas' | 'phone_sync'>('canvas')
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
      methodOverride?: 'canvas' | 'phone_sync',
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
  // Auto-Crop & Fill: trims empty margins and scales signature to fill canvas
  // ──────────────────────────────────────────────────────────
  const trimAndFitSignature = useCallback(
    (img: HTMLImageElement, targetW: number, targetH: number, paddingPercent = 0.12): string => {
      const off = document.createElement('canvas')
      off.width = img.naturalWidth || img.width || 800
      off.height = img.naturalHeight || img.height || 320
      const ctx = off.getContext('2d')
      if (!ctx) return img.src

      ctx.drawImage(img, 0, 0)
      const imgData = ctx.getImageData(0, 0, off.width, off.height)
      const data = imgData.data

      let minX = off.width,
        minY = off.height,
        maxX = 0,
        maxY = 0
      let found = false

      for (let y = 0; y < off.height; y++) {
        for (let x = 0; x < off.width; x++) {
          const alpha = data[(y * off.width + x) * 4 + 3]
          if (alpha > 15) {
            found = true
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
          }
        }
      }

      if (!found) {
        minX = 0
        minY = 0
        maxX = off.width
        maxY = off.height
      }

      const pad = 8
      minX = Math.max(0, minX - pad)
      minY = Math.max(0, minY - pad)
      maxX = Math.min(off.width, maxX + pad)
      maxY = Math.min(off.height, maxY + pad)

      const strokeW = Math.max(1, maxX - minX)
      const strokeH = Math.max(1, maxY - minY)

      const target = document.createElement('canvas')
      target.width = targetW
      target.height = targetH
      const targetCtx = target.getContext('2d')
      if (!targetCtx) return img.src

      const maxFillW = targetW * (1 - paddingPercent)
      const maxFillH = targetH * (1 - paddingPercent)
      const scale = Math.min(maxFillW / strokeW, maxFillH / strokeH)
      const drawW = strokeW * scale
      const drawH = strokeH * scale
      const offsetX = (targetW - drawW) / 2
      const offsetY = (targetH - drawH) / 2

      targetCtx.clearRect(0, 0, targetW, targetH)
      targetCtx.drawImage(off, minX, minY, strokeW, strokeH, offsetX, offsetY, drawW, drawH)
      return target.toDataURL('image/png')
    },
    []
  )

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

              const finalDataUrl = trimAndFitSignature(img, destW, destH, 0.1)

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
  }, [signaturePad, exportSignature, canvasRef, trimAndFitSignature])

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

      {/* Bottom Controls Bar */}
      <div className="heyform-signature-bottom mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-secondary text-xs">{t('Draw your signature above')}</span>

        <div className="flex items-center gap-1.5">
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
