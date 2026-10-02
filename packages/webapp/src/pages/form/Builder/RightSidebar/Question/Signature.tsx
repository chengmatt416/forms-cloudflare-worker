import { IconShieldCheck, IconShieldLock } from '@tabler/icons-react'
import { startTransition, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { Input, Switch } from '@/components'

import { useStoreContext } from '../../store'
import { RequiredSettingsProps } from './Required'

export default function SignatureSettings({ field }: RequiredSettingsProps) {
  const { t } = useTranslation()
  const { dispatch } = useStoreContext()

  const handleChange = useCallback(
    (key: string, value: any) => {
      startTransition(() => {
        dispatch({
          type: 'updateField',
          payload: {
            id: field.id,
            updates: {
              properties: {
                ...field.properties,
                [key]: value
              }
            }
          }
        })
      })
    },
    [dispatch, field]
  )

  const props = (field.properties || {}) as any
  const isLegal = Boolean(props.isLegalSignature ?? props.isLegal)
  const defaultConsentText =
    t(
      '本人聲明此電子簽章具備法律效力，等同於本人親筆簽名，並同意記錄簽署時間、IP位址與防竄改數位指紋作為存證紀錄。'
    ) ||
    '本人聲明此電子簽章具備法律效力，等同於本人親筆簽名，並同意記錄簽署時間、IP位址與防竄改數位指紋作為存證紀錄。'
  const legalConsentText =
    props.legalConsentText !== undefined ? props.legalConsentText : defaultConsentText
  const requireConsentCheckbox = props.requireConsentCheckbox ?? true

  return (
    <div className="space-y-3 pt-2">
      {/* Legal E-Signature Toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <label
            className="flex items-center gap-1.5 text-sm font-medium"
            htmlFor="isLegalSignature"
          >
            <IconShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>{t('form.builder.settings.signature.isLegal', '法定電子簽章與存證')}</span>
          </label>
          <span className="text-secondary mt-0.5 text-xs">
            {t(
              'form.builder.settings.signature.isLegalDescription',
              '符合《電子簽章法》與 ESIGN，記錄 SHA-256 數位指紋與 IP 存證軌跡'
            )}
          </span>
        </div>
        <Switch value={isLegal} onChange={value => handleChange('isLegalSignature', value)} />
      </div>

      {/* Expanded Legal Options */}
      {isLegal && (
        <div className="space-y-3 rounded-lg border border-emerald-500/20 bg-emerald-50/40 p-3 dark:bg-emerald-950/20">
          {/* Require consent checkbox switch */}
          <div className="flex items-center justify-between gap-2">
            <label
              className="text-xs font-medium text-slate-700 dark:text-slate-200"
              htmlFor="requireConsent"
            >
              {t('form.builder.settings.signature.requireConsentCheckbox', '強制勾選同意法律聲明')}
            </label>
            <Switch
              value={requireConsentCheckbox}
              onChange={value => handleChange('requireConsentCheckbox', value)}
            />
          </div>

          {/* Legal Consent Declaration Text */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-200">
              {t('form.builder.settings.signature.consentDeclaration', '法律聲明與同意條款')}
            </label>
            <Input.TextArea
              rows={3}
              value={legalConsentText}
              onChange={value => handleChange('legalConsentText', value)}
              placeholder={defaultConsentText}
              className="text-xs"
            />
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <IconShieldLock className="h-3.5 w-3.5 text-emerald-600" />
              <span>{t('已啟用 SHA-256 不可否認性數位存證與伺服器時間戳')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
