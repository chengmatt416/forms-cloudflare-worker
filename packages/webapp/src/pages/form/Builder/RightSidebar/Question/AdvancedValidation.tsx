import { FieldKindEnum, QUESTION_FIELD_KINDS } from '@heyform-inc/shared-types-enums'
import { IconChevronDown, IconChevronRight, IconWand } from '@tabler/icons-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input, RegexGeneratorModal, Select, Switch } from '@/components'
import { FormFieldType } from '@/types'

import { useStoreContext } from '../../store'

export interface AdvancedValidationSettingsProps {
  field: FormFieldType
}

const TYPE_DESCRIPTIONS: Record<string, string> = {
  regex: 'Match input against custom rules or formats (e.g. employee IDs, order numbers).',
  min_max: 'Enforce a minimum or maximum numeric amount or character length.',
  format: 'Require common standard formats like numbers-only, lowercase, or allowed email domain.',
  disallowed: 'Block specific forbidden words, test entries, or profanity.',
  exact: 'Require an exact passcode, coupon code, or secret answer to proceed.'
}

export default function AdvancedValidationSettings({ field }: AdvancedValidationSettingsProps) {
  const { t } = useTranslation()
  const { dispatch } = useStoreContext()
  const [isExpanded, setIsExpanded] = useState(true)
  const [isRegexModalOpen, setIsRegexModalOpen] = useState(false)

  const advanced = (field.validations as any)?.advanced || {}
  const isEnabled = Boolean(advanced.enabled)

  const updateAdvanced = useCallback(
    (updates: any) => {
      dispatch({
        type: 'updateField',
        payload: {
          id: field.id,
          updates: {
            validations: {
              ...field.validations,
              advanced: {
                ...advanced,
                ...updates
              }
            }
          }
        }
      })
    },
    [dispatch, field.id, field.validations, advanced]
  )

  const handleToggle = useCallback(
    (enabled: boolean) => {
      updateAdvanced({
        enabled,
        type: advanced.type || 'regex'
      })
      if (enabled) {
        setIsExpanded(true)
      }
    },
    [updateAdvanced, advanced.type]
  )

  if (!QUESTION_FIELD_KINDS.includes(field.kind) || field.kind === FieldKindEnum.GROUP) {
    return null
  }

  const VALIDATION_TYPE_OPTIONS = [
    { label: t('Custom Regex Pattern'), value: 'regex' },
    { label: t('Min / Max Range or Length'), value: 'min_max' },
    { label: t('Format Preset'), value: 'format' },
    { label: t('Disallowed / Forbidden Values'), value: 'disallowed' },
    { label: t('Exact Match / Passcode'), value: 'exact' }
  ]

  const FORMAT_OPTIONS = [
    { label: t('Alphanumeric (Letters & Digits)'), value: 'alphanumeric' },
    { label: t('Digits Only (0-9)'), value: 'numeric' },
    { label: t('Letters Only (A-Z, a-z)'), value: 'alpha' },
    { label: t('Lowercase Only'), value: 'lowercase' },
    { label: t('Uppercase Only'), value: 'uppercase' },
    { label: t('No Special Characters'), value: 'no_special_chars' },
    { label: t('Integer Only (Whole Numbers)'), value: 'integer_only' },
    { label: t('Positive Number (> 0)'), value: 'positive_number' },
    { label: t('Authorized Email Domain'), value: 'email_domain' },
    { label: t('HTTPS Only (https://)'), value: 'url_https' }
  ]

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between">
        <div
          className="flex cursor-pointer items-center space-x-1.5 text-sm/6 font-medium text-slate-800 select-none dark:text-slate-200"
          onClick={() => handleToggle(!isEnabled)}
        >
          {isEnabled ? (
            <IconChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <IconChevronRight className="h-4 w-4 text-slate-400" />
          )}
          <span>{t('Advanced Value Check')}</span>
        </div>
        <Switch value={isEnabled} onChange={handleToggle} />
      </div>

      {isEnabled && (
        <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700/60 dark:bg-slate-800/60">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('Check Type')}
            </label>
            <Select
              options={VALIDATION_TYPE_OPTIONS}
              value={advanced.type || 'regex'}
              onChange={val => updateAdvanced({ type: val })}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              {TYPE_DESCRIPTIONS[advanced.type || 'regex']}
            </p>
          </div>

          {advanced.type === 'regex' && (
            <>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                    {t('Regex Pattern')}
                  </label>
                  <button
                    type="button"
                    className="text-primary-600 hover:text-primary-700 dark:text-primary-400 inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium"
                    onClick={() => setIsRegexModalOpen(true)}
                  >
                    <IconWand className="h-3.5 w-3.5" />
                    <span>{t('Pattern Generator')}</span>
                  </button>
                </div>
                <Input
                  placeholder="e.g. ^[A-Z]{3}-\d{4}$"
                  value={advanced.regex || ''}
                  onChange={val => updateAdvanced({ regex: val })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('Regex Flags (optional)')}
                </label>
                <Input
                  placeholder="e.g. i"
                  value={advanced.regexFlags || ''}
                  onChange={val => updateAdvanced({ regexFlags: val })}
                />
              </div>

              <RegexGeneratorModal
                open={isRegexModalOpen}
                initialPattern={advanced.regex}
                initialFlags={advanced.regexFlags}
                onClose={() => setIsRegexModalOpen(false)}
                onApply={(newPattern, newFlags) => {
                  updateAdvanced({ regex: newPattern, regexFlags: newFlags })
                }}
              />
            </>
          )}

          {advanced.type === 'min_max' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('Min Value / Length')}
                </label>
                <Input
                  type="number"
                  placeholder="Min"
                  value={advanced.min !== undefined ? String(advanced.min) : ''}
                  onChange={val => updateAdvanced({ min: val !== '' ? Number(val) : undefined })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('Max Value / Length')}
                </label>
                <Input
                  type="number"
                  placeholder="Max"
                  value={advanced.max !== undefined ? String(advanced.max) : ''}
                  onChange={val => updateAdvanced({ max: val !== '' ? Number(val) : undefined })}
                />
              </div>
            </div>
          )}

          {advanced.type === 'format' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('Format Preset')}
                </label>
                <Select
                  options={FORMAT_OPTIONS}
                  value={advanced.format || 'alphanumeric'}
                  onChange={val => updateAdvanced({ format: val })}
                />
              </div>
              {advanced.format === 'email_domain' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    {t('Allowed Domain')}
                  </label>
                  <Input
                    placeholder="e.g. @company.com"
                    value={advanced.formatValue || ''}
                    onChange={val => updateAdvanced({ formatValue: val })}
                  />
                </div>
              )}
            </>
          )}

          {advanced.type === 'disallowed' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('Forbidden Values (Comma-separated)')}
              </label>
              <Input
                placeholder="e.g. test, admin, spam, root"
                value={advanced.disallowedValues || ''}
                onChange={val => updateAdvanced({ disallowedValues: val })}
              />
            </div>
          )}

          {advanced.type === 'exact' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('Expected Exact Value / Secret')}
              </label>
              <Input
                placeholder="e.g. PROMO2026 or secret-pass"
                value={advanced.expectedValue || ''}
                onChange={val => updateAdvanced({ expectedValue: val })}
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('Custom Error Message (Optional)')}
            </label>
            <Input
              placeholder={t('e.g. Please enter a valid employee code')}
              value={advanced.errorMessage || ''}
              onChange={val => updateAdvanced({ errorMessage: val })}
            />
          </div>
        </div>
      )}
    </div>
  )
}
