import type { FC } from 'react'

import { useTranslation } from '../utils'

import { FormField, SignaturePad } from '../components'
import { useStore } from '../store'
import type { BlockProps } from './Block'
import { Block } from './Block'
import { Form } from './Form'

export const Signature: FC<BlockProps> = ({ field, ...restProps }) => {
  const { state } = useStore()
  const { t } = useTranslation()

  function getValues(values: any) {
    return values.input
  }

  const props = (field.properties || {}) as any
  const isLegal = Boolean(props.isLegalSignature ?? props.isLegal)
  const legalConsentText = props.legalConsentText
  const requireConsentCheckbox = props.requireConsentCheckbox ?? true

  return (
    <Block className="heyform-signature" field={field} {...restProps}>
      <Form
        initialValues={{
          input: state.values[field.id]
        }}
        field={field}
        getValues={getValues}
      >
        <FormField
          name="input"
          rules={[
            {
              required: field.validations?.required,
              message: t('This field is required')
            },
            {
              validator: async (_, value) => {
                if (isLegal && requireConsentCheckbox && value) {
                  if (
                    typeof value === 'object' &&
                    value.audit &&
                    value.audit.consentAccepted === false
                  ) {
                    return Promise.reject(t('You must agree to the legal declaration to proceed'))
                  }
                }
                return Promise.resolve()
              }
            }
          ]}
        >
          <SignaturePad
            isLegal={isLegal}
            legalConsentText={legalConsentText}
            requireConsentCheckbox={requireConsentCheckbox}
          />
        </FormField>
      </Form>
    </Block>
  )
}
