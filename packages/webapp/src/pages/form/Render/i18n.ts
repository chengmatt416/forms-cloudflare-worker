import { locales } from '@heyform-inc/form-renderer'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const resources = locales || {
  en: {}
}
const supportedLngs = Object.keys(resources)
const lng = supportedLngs[0] || 'en'

i18n.use(initReactI18next).init({
  lowerCaseLng: true,
  resources,
  lng,
  fallbackLng: 'en',
  supportedLngs,
  interpolation: {
    escapeValue: false
  },
  react: {
    // https://react.i18next.com/latest/trans-component#trans-props
    transSupportBasicHtmlNodes: true,
    transKeepBasicHtmlNodesFor: ['br', 'strong', 'b', 'i', 'a']
  }
})

export default i18n
