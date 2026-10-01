import { IconCheck, IconCopy, IconSparkles, IconWand, IconX } from '@tabler/icons-react'
import type { FC } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from './Button'
import { Input } from './Input'
import { Modal } from './Modal'
import { Switch } from './Switch'

export interface RegexGeneratorModalProps {
  open: boolean
  initialPattern?: string
  initialFlags?: string
  onClose: () => void
  onApply: (pattern: string, flags?: string) => void
}

interface Preset {
  id: string
  name: string
  description: string
  pattern: string
  flags?: string
  example: string
}

const REGEX_PRESETS: Preset[] = [
  {
    id: 'digits',
    name: 'Numbers Only (Digits)',
    description: 'Only allows numeric digits 0-9',
    pattern: '^\\d+$',
    example: '12345678'
  },
  {
    id: 'letters',
    name: 'Letters Only (A-Z, a-z)',
    description: 'Only alphabetic letters, no numbers or spaces',
    pattern: '^[a-zA-Z]+$',
    example: 'HelloWorld'
  },
  {
    id: 'lowercase',
    name: 'Lowercase Letters Only',
    description: 'Lowercase letters only (a-z)',
    pattern: '^[a-z]+$',
    example: 'username'
  },
  {
    id: 'uppercase',
    name: 'Uppercase Letters Only',
    description: 'Uppercase letters only (A-Z)',
    pattern: '^[A-Z]+$',
    example: 'USCAN'
  },
  {
    id: 'alphanumeric',
    name: 'Alphanumeric',
    description: 'Letters and numbers without symbols',
    pattern: '^[a-zA-Z0-9]+$',
    example: 'User2026'
  },
  {
    id: 'alphanumeric-dashes',
    name: 'Alphanumeric with Dashes/Underscores',
    description: 'Letters, numbers, hyphens, and underscores',
    pattern: '^[a-zA-Z0-9_-]+$',
    example: 'user_account-123'
  },
  {
    id: 'email',
    name: 'Email Address',
    description: 'Standard email address verification',
    pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
    example: 'alex@example.com'
  },
  {
    id: 'phone-us',
    name: 'US Phone Number',
    description: '10-digit US phone numbers with optional formatting',
    pattern: '^(\\+?1[-.\\s]?)?(\\(?\\d{3}\\)?[-.\\s]?)?\\d{3}[-.\\s]?\\d{4}$',
    example: '(555) 123-4567'
  },
  {
    id: 'phone-intl',
    name: 'International Phone',
    description: 'E.164 and international phone number formats',
    pattern: '^\\+?[0-9\\s\\-()]{7,20}$',
    example: '+1 415 555 2671'
  },
  {
    id: 'url',
    name: 'Website URL (HTTP/HTTPS)',
    description: 'Web URL starting with http:// or https://',
    pattern: '^https?:\\/\\/[^\\s$.?#].[^\\s]*$',
    example: 'https://heyform.net'
  },
  {
    id: 'zip-us',
    name: 'US Zip / Postal Code',
    description: '5-digit or 9-digit (ZIP+4) postal code',
    pattern: '^\\d{5}(-\\d{4})?$',
    example: '94103-1234'
  },
  {
    id: 'postal-uk',
    name: 'UK Postal Code',
    description: 'Standard UK postcode format',
    pattern: '^[A-Z]{1,2}[0-9][A-Z0-9]?\\s?[0-9][A-Z]{2}$',
    flags: 'i',
    example: 'SW1A 1AA'
  },
  {
    id: 'hex-color',
    name: 'Hex Color Code',
    description: '3-digit or 6-digit hexadecimal color code',
    pattern: '^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$',
    example: '#4F46E5'
  },
  {
    id: 'date-iso',
    name: 'Date (YYYY-MM-DD)',
    description: 'ISO 8601 standard date format',
    pattern: '^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$',
    example: '2026-10-01'
  },
  {
    id: 'time-24h',
    name: 'Time (24h HH:MM)',
    description: '24-hour time format from 00:00 to 23:59',
    pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$',
    example: '14:30'
  },
  {
    id: 'credit-card',
    name: 'Credit Card (16 Digits)',
    description: '16 numeric digits with optional spaces or dashes',
    pattern: '^\\d{4}[-\\s]?\\d{4}[-\\s]?\\d{4}[-\\s]?\\d{4}$',
    example: '4532-1234-5678-9010'
  },
  {
    id: 'strong-password',
    name: 'Strong Password (8+ chars)',
    description: 'At least 1 uppercase, 1 lowercase, 1 digit, 1 special char',
    pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$',
    example: 'HeyForm2026!'
  }
]

export const RegexGeneratorModal: FC<RegexGeneratorModalProps> = ({
  open,
  initialPattern = '',
  initialFlags = '',
  onClose,
  onApply
}) => {
  const { t } = useTranslation()

  const [activeTab, setActiveTab] = useState<'presets' | 'builder' | 'manual'>('presets')
  const [pattern, setPattern] = useState(initialPattern)
  const [flags, setFlags] = useState(initialFlags)
  const [testString, setTestString] = useState('')
  const [copied, setCopied] = useState(false)

  // Custom builder states
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [allowDigits, setAllowDigits] = useState(true)
  const [allowUpper, setAllowUpper] = useState(true)
  const [allowLower, setAllowLower] = useState(true)
  const [allowSpace, setAllowSpace] = useState(false)
  const [allowDash, setAllowDash] = useState(false)
  const [allowUnderscore, setAllowUnderscore] = useState(false)
  const [customChars, setCustomChars] = useState('')
  const [lengthMode, setLengthMode] = useState<'any' | 'exact' | 'range'>('any')
  const [exactLength, setExactLength] = useState('6')
  const [minLength, setMinLength] = useState('3')
  const [maxLength, setMaxLength] = useState('10')
  const [caseInsensitive, setCaseInsensitive] = useState(false)

  useEffect(() => {
    if (open) {
      setPattern(initialPattern || '^\\d+$')
      setFlags(initialFlags || '')
      setTestString('')
      setCopied(false)
    }
  }, [initialFlags, initialPattern, open])

  // Rebuild pattern in builder mode
  function generateFromBuilder() {
    let charClass = ''
    if (allowLower && allowUpper) {
      charClass += 'a-zA-Z'
    } else if (allowLower) {
      charClass += 'a-z'
    } else if (allowUpper) {
      charClass += 'A-Z'
    }
    if (allowDigits) {
      charClass += '0-9'
    }
    if (allowSpace) {
      charClass += '\\s'
    }
    if (allowDash) {
      charClass += '\\-'
    }
    if (allowUnderscore) {
      charClass += '_'
    }
    if (customChars) {
      const escapedCustom = customChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
      charClass += escapedCustom
    }

    if (!charClass) {
      charClass = '.'
    } else {
      charClass = `[${charClass}]`
    }

    let quantifier = '+'
    if (lengthMode === 'exact') {
      const len = parseInt(exactLength, 10) || 1
      quantifier = `{${len}}`
    } else if (lengthMode === 'range') {
      const min = parseInt(minLength, 10) || 0
      const max = parseInt(maxLength, 10) || ''
      quantifier = `{${min},${max}}`
    }

    const escPrefix = prefix ? prefix.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') : ''
    const escSuffix = suffix ? suffix.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') : ''

    const built = `^${escPrefix}${charClass}${quantifier}${escSuffix}$`
    setPattern(built)
    setFlags(caseInsensitive ? 'i' : '')
  }

  // Update built pattern whenever builder options change
  useEffect(() => {
    if (activeTab === 'builder') {
      generateFromBuilder()
    }
  }, [
    activeTab,
    prefix,
    suffix,
    allowDigits,
    allowUpper,
    allowLower,
    allowSpace,
    allowDash,
    allowUnderscore,
    customChars,
    lengthMode,
    exactLength,
    minLength,
    maxLength,
    caseInsensitive
  ])

  // Test pattern against sample string
  const testResult = useMemo(() => {
    if (!testString) return null
    try {
      const rx = new RegExp(pattern, flags)
      return rx.test(testString)
    } catch {
      return false
    }
  }, [flags, pattern, testString])

  function handleSelectPreset(preset: Preset) {
    setPattern(preset.pattern)
    setFlags(preset.flags || '')
    setTestString(preset.example)
  }

  function handleCopy() {
    navigator.clipboard?.writeText(pattern)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleApply() {
    onApply(pattern, flags)
    onClose()
  }

  return (
    <Modal
      open={open}
      contentProps={{
        className: 'max-w-2xl max-h-[88vh] flex flex-col p-0 overflow-hidden'
      }}
      onOpenChange={v => !v && onClose()}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex items-center gap-2">
          <div className="bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 rounded-lg p-2">
            <IconWand className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {t('Regex Pattern Generator')}
            </h2>
            <p className="text-xs text-slate-500">
              {t('Select a common preset or visually build custom validation rules')}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50/30 px-6 dark:border-slate-800 dark:bg-slate-900/30">
        <button
          type="button"
          className={`cursor-pointer border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
            activeTab === 'presets'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
          onClick={() => setActiveTab('presets')}
        >
          {t('Common Presets')}
        </button>
        <button
          type="button"
          className={`cursor-pointer border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
            activeTab === 'builder'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
          onClick={() => {
            setActiveTab('builder')
            generateFromBuilder()
          }}
        >
          {t('Visual Rule Builder')}
        </button>
        <button
          type="button"
          className={`cursor-pointer border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
            activeTab === 'manual'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
          onClick={() => setActiveTab('manual')}
        >
          {t('Direct Pattern Edit')}
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 space-y-5 overflow-y-auto p-6">
        {activeTab === 'presets' && (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {REGEX_PRESETS.map(preset => {
              const isSelected = pattern === preset.pattern
              return (
                <div
                  key={preset.id}
                  className={`cursor-pointer rounded-lg border p-3 text-left transition-all ${
                    isSelected
                      ? 'border-primary-500 bg-primary-50/40 dark:bg-primary-950/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700'
                  }`}
                  onClick={() => handleSelectPreset(preset)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {preset.name}
                    </span>
                    {isSelected && <IconCheck className="text-primary-500 h-4 w-4 shrink-0" />}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
                    {preset.description}
                  </p>
                  <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-slate-400 dark:text-slate-500">
                    <span className="max-w-[150px] truncate">{preset.pattern}</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      e.g. {preset.example}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'builder' && (
          <div className="space-y-4">
            {/* Allowed Characters */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('Allowed Characters')}
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <label className="flex cursor-pointer items-center space-x-2 rounded-md border border-slate-200 p-2 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/50">
                  <input
                    type="checkbox"
                    checked={allowDigits}
                    onChange={e => setAllowDigits(e.target.checked)}
                    className="text-primary-600 focus:ring-primary-500 rounded border-slate-300"
                  />
                  <span>Digits (0-9)</span>
                </label>
                <label className="flex cursor-pointer items-center space-x-2 rounded-md border border-slate-200 p-2 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/50">
                  <input
                    type="checkbox"
                    checked={allowUpper}
                    onChange={e => setAllowUpper(e.target.checked)}
                    className="text-primary-600 focus:ring-primary-500 rounded border-slate-300"
                  />
                  <span>Uppercase (A-Z)</span>
                </label>
                <label className="flex cursor-pointer items-center space-x-2 rounded-md border border-slate-200 p-2 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/50">
                  <input
                    type="checkbox"
                    checked={allowLower}
                    onChange={e => setAllowLower(e.target.checked)}
                    className="text-primary-600 focus:ring-primary-500 rounded border-slate-300"
                  />
                  <span>Lowercase (a-z)</span>
                </label>
                <label className="flex cursor-pointer items-center space-x-2 rounded-md border border-slate-200 p-2 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/50">
                  <input
                    type="checkbox"
                    checked={allowSpace}
                    onChange={e => setAllowSpace(e.target.checked)}
                    className="text-primary-600 focus:ring-primary-500 rounded border-slate-300"
                  />
                  <span>Spaces</span>
                </label>
                <label className="flex cursor-pointer items-center space-x-2 rounded-md border border-slate-200 p-2 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/50">
                  <input
                    type="checkbox"
                    checked={allowDash}
                    onChange={e => setAllowDash(e.target.checked)}
                    className="text-primary-600 focus:ring-primary-500 rounded border-slate-300"
                  />
                  <span>Hyphens (-)</span>
                </label>
                <label className="flex cursor-pointer items-center space-x-2 rounded-md border border-slate-200 p-2 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/50">
                  <input
                    type="checkbox"
                    checked={allowUnderscore}
                    onChange={e => setAllowUnderscore(e.target.checked)}
                    className="text-primary-600 focus:ring-primary-500 rounded border-slate-300"
                  />
                  <span>Underscores (_)</span>
                </label>
              </div>
            </div>

            {/* Custom Extra Characters */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('Additional Specific Characters (Optional)')}
              </label>
              <Input
                placeholder="e.g. @#.$"
                value={customChars}
                onChange={val => setCustomChars(val as string)}
              />
            </div>

            {/* Prefix & Suffix */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('Must Start With (Prefix)')}
                </label>
                <Input
                  placeholder="e.g. ID- or EMP"
                  value={prefix}
                  onChange={val => setPrefix(val as string)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('Must End With (Suffix)')}
                </label>
                <Input
                  placeholder="e.g. -US or .com"
                  value={suffix}
                  onChange={val => setSuffix(val as string)}
                />
              </div>
            </div>

            {/* Length Constraint */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('Length Constraint')}
              </label>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={`cursor-pointer rounded-md border px-3 py-1 text-xs ${
                    lengthMode === 'any'
                      ? 'border-primary-500 bg-primary-50 text-primary-600 font-medium'
                      : 'border-slate-200 text-slate-600'
                  }`}
                  onClick={() => setLengthMode('any')}
                >
                  Any Length (1+)
                </button>
                <button
                  type="button"
                  className={`cursor-pointer rounded-md border px-3 py-1 text-xs ${
                    lengthMode === 'exact'
                      ? 'border-primary-500 bg-primary-50 text-primary-600 font-medium'
                      : 'border-slate-200 text-slate-600'
                  }`}
                  onClick={() => setLengthMode('exact')}
                >
                  Exact Length
                </button>
                <button
                  type="button"
                  className={`cursor-pointer rounded-md border px-3 py-1 text-xs ${
                    lengthMode === 'range'
                      ? 'border-primary-500 bg-primary-50 text-primary-600 font-medium'
                      : 'border-slate-200 text-slate-600'
                  }`}
                  onClick={() => setLengthMode('range')}
                >
                  Min / Max Range
                </button>
              </div>

              {lengthMode === 'exact' && (
                <div className="w-36">
                  <Input
                    type="number"
                    placeholder="Length"
                    value={exactLength}
                    onChange={val => setExactLength(String(val))}
                  />
                </div>
              )}

              {lengthMode === 'range' && (
                <div className="flex max-w-xs items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={minLength}
                    onChange={val => setMinLength(String(val))}
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={maxLength}
                    onChange={val => setMaxLength(String(val))}
                  />
                </div>
              )}
            </div>

            {/* Case Insensitive */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t('Case Insensitive (Ignore uppercase/lowercase difference)')}
                </span>
              </div>
              <Switch value={caseInsensitive} onChange={setCaseInsensitive} />
            </div>
          </div>
        )}

        {activeTab === 'manual' && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('Regular Expression Pattern')}
              </label>
              <Input
                placeholder="e.g. ^[A-Z]{3}-\d{4}$"
                value={pattern}
                onChange={val => setPattern(val as string)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('Flags (optional)')}
              </label>
              <Input
                placeholder="e.g. i or g"
                value={flags}
                onChange={val => setFlags(val as string)}
              />
            </div>
          </div>
        )}

        {/* Live Pattern Preview & Tester */}
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <IconSparkles className="text-primary-500 h-4 w-4" />
              {t('Generated Pattern')}
            </span>
            <button
              type="button"
              className="inline-flex cursor-pointer items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              onClick={handleCopy}
            >
              <IconCopy className="h-3.5 w-3.5" />
              <span>{copied ? t('Copied!') : t('Copy')}</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-2.5 font-mono text-xs text-slate-900 select-all dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
            /{pattern}/{flags}
          </div>

          {/* Live Tester Input */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('Test with sample text')}
            </label>
            <div className="relative">
              <Input
                placeholder={t('Enter text here to test against regex...')}
                value={testString}
                onChange={val => setTestString(val as string)}
              />
            </div>

            {testString && (
              <div
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                  testResult
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : 'border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                }`}
              >
                {testResult ? (
                  <>
                    <IconCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{t('Match! The sample input satisfies this pattern.')}</span>
                  </>
                ) : (
                  <>
                    <IconX className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    <span>{t('No match. The sample input does not satisfy this pattern.')}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/50 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-900/50">
        <Button.Link size="sm" onClick={onClose}>
          {t('Cancel')}
        </Button.Link>
        <Button size="sm" onClick={handleApply}>
          {t('Apply Pattern')}
        </Button>
      </div>
    </Modal>
  )
}
export default RegexGeneratorModal
