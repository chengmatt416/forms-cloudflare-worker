import type { IFormField } from '../typings'

export function validateAdvancedValue(
  field: IFormField,
  value: any,
  t: (key: string, opt?: any) => string = (k: string) => k
): string | undefined {
  const adv = (field.validations as any)?.advanced

  // If not enabled or no advanced rules, check direct validations.regex if present
  const vAny = (field.validations as any) || {}
  if (!adv || !adv.enabled) {
    if (vAny.regex && value !== undefined && value !== null && value !== '') {
      try {
        const reg = new RegExp(vAny.regex)
        if (!reg.test(String(value))) {
          return vAny.customErrorMessage || t('The value format is invalid')
        }
      } catch (e) {
        // ignore regex error
      }
    }
    return undefined
  }

  // If value is empty and not required, don't fail advanced check unless exact match or disallowed
  const isEmpty =
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  if (isEmpty) {
    if (!field.validations?.required && adv.type !== 'exact') {
      return undefined
    }
  }

  const customError = adv.errorMessage

  switch (adv.type) {
    case 'regex': {
      if (!adv.regex) return undefined
      try {
        const reg = new RegExp(adv.regex, adv.regexFlags || '')
        if (!reg.test(String(value ?? ''))) {
          return customError || t('The value does not match the required pattern')
        }
      } catch (e) {
        // ignore invalid regex syntax
      }
      break
    }

    case 'min_max': {
      if (typeof value === 'number') {
        if (adv.min !== undefined && value < adv.min) {
          return customError || t('Value must be at least {{min}}', { min: adv.min })
        }
        if (adv.max !== undefined && value > adv.max) {
          return customError || t('Value must be at most {{max}}', { max: adv.max })
        }
      } else if (Array.isArray(value)) {
        if (adv.min !== undefined && value.length < adv.min) {
          return customError || t('Choose at least {{min}} choices', { min: adv.min })
        }
        if (adv.max !== undefined && value.length > adv.max) {
          return customError || t('Choose up to {{max}} choices', { max: adv.max })
        }
      } else {
        const str = String(value ?? '')
        if (adv.min !== undefined && str.length < adv.min) {
          return customError || t('Minimum {{min}} characters required', { min: adv.min })
        }
        if (adv.max !== undefined && str.length > adv.max) {
          return customError || t('Maximum {{max}} characters allowed', { max: adv.max })
        }
      }
      break
    }

    case 'format': {
      const str = String(value ?? '').trim()
      switch (adv.format) {
        case 'alphanumeric':
          if (!/^[a-zA-Z0-9]+$/.test(str)) {
            return customError || t('Only letters and numbers are allowed')
          }
          break
        case 'numeric':
          if (!/^\d+$/.test(str)) {
            return customError || t('Only digits (0-9) are allowed')
          }
          break
        case 'alpha':
          if (!/^[a-zA-Z\s]+$/.test(str)) {
            return customError || t('Only letters are allowed')
          }
          break
        case 'lowercase':
          if (str !== str.toLowerCase()) {
            return customError || t('Only lowercase letters are allowed')
          }
          break
        case 'uppercase':
          if (str !== str.toUpperCase()) {
            return customError || t('Only uppercase letters are allowed')
          }
          break
        case 'no_special_chars':
          if (!/^[a-zA-Z0-9\s]+$/.test(str)) {
            return customError || t('Special characters are not allowed')
          }
          break
        case 'integer_only': {
          const num = Number(value)
          if (!Number.isInteger(num)) {
            return customError || t('Must be a whole number (integer)')
          }
          break
        }
        case 'positive_number': {
          const num = Number(value)
          if (isNaN(num) || num <= 0) {
            return customError || t('Must be a positive number')
          }
          break
        }
        case 'email_domain': {
          if (adv.formatValue && !str.toLowerCase().endsWith(adv.formatValue.toLowerCase())) {
            return customError || t('Email must end with {{domain}}', { domain: adv.formatValue })
          }
          break
        }
        case 'url_https': {
          if (!str.toLowerCase().startsWith('https://')) {
            return customError || t('URL must start with https://')
          }
          break
        }
      }
      break
    }

    case 'disallowed': {
      if (adv.disallowedValues) {
        const disallowedList = adv.disallowedValues
          .split(',')
          .map((s: string) => s.trim().toLowerCase())
          .filter(Boolean)
        const str = String(value ?? '').toLowerCase()
        const hasForbidden = disallowedList.some((item: string) => str.includes(item))
        if (hasForbidden) {
          return customError || t('This value is not permitted')
        }
      }
      break
    }

    case 'exact': {
      if (adv.expectedValue !== undefined && adv.expectedValue !== '') {
        if (String(value ?? '').trim() !== String(adv.expectedValue).trim()) {
          return customError || t('The answer is incorrect')
        }
      }
      break
    }
  }

  return undefined
}

export function getFieldValidationRules(field: IFormField, t: any) {
  const rules: any[] = []

  if (field.validations?.required) {
    rules.push({
      required: true,
      message: t('This field is required')
    })
  }

  rules.push({
    validator: async (_: any, val: any) => {
      const errorMsg = validateAdvancedValue(field, val, t)
      if (errorMsg) {
        throw new Error(errorMsg)
      }
    }
  })

  return rules
}
