import { locales } from '@heyform-inc/form-renderer/src'
import { FormModel } from '@heyform-inc/shared-types-enums'
import { useEffect, useState } from 'react'

import { getFormLanguage } from './utils/brower-language'
import { setFormMetadata } from './utils/metadata'
import { FormService } from '@/services'
import { useParam, useQuery } from '@/utils'

import { Async } from '@/components'
import '@/styles/render.scss'
import { FormThemeSettings } from '@/types'

import { Renderer } from './components/Renderer'

const LANGUAGES = Object.keys(locales)

export default function FormRender() {
  const { formId } = useParam()
  const query = useQuery()

  const [form, setForm] = useState<FormModel | null>(null)
  const [locale, setLocale] = useState<string>()

  useEffect(() => {
    if (form) {
      return setFormMetadata(form.name, (form.themeSettings as FormThemeSettings)?.favicon)
    }
  }, [form])

  async function fetchData() {
    if (!formId) {
      throw new Error('Form ID is missing')
    }
    const result = await FormService.publicForm(formId)
    if (!result || !result.id) {
      throw new Error('Form not found or has been removed')
    }

    setForm(result)
    setLocale(getFormLanguage(LANGUAGES, result.settings?.locale))

    return true
  }

  return (
    <Async
      fetch={fetchData}
      loader={
        <div className="flex h-screen w-screen items-center justify-center bg-white">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-slate-800" />
        </div>
      }
      errorRender={err => (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-white p-6 text-center">
          <h2 className="text-xl font-semibold text-slate-800">無法載入表單</h2>
          <p className="mt-2 text-sm text-slate-500">{err.message}</p>
        </div>
      )}
    >
      {form && (
        <div id="heyform-render-root">
          <Renderer form={form} query={query} locale={locale!} />
        </div>
      )}
    </Async>
  )
}
