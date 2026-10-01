import type { FC } from 'react'

import { useTranslation, validateAdvancedValue } from '../utils'

import { FormField, Input } from '../components'
import { useStore } from '../store'
import type { BlockProps } from './Block'
import { Block } from './Block'
import { Form } from './Form'

export const Number: FC<BlockProps> = ({ field, ...restProps }) => {
  const { state } = useStore()
  const { t } = useTranslation()

  function getValues(values: any) {
    return values.input
  }

  return (
    <Block className="heyform-number" field={field} {...restProps}>
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
              type: 'number',
              message: t('This field is required')
            },
            {
              validator: async (_, val) => {
                const err = validateAdvancedValue(field, val, t)
                if (err) throw new Error(err)
              }
            }
          ]}
        >
          <Input type="number" placeholder={t('Your answer goes here')} />
        </FormField>
      </Form>
    </Block>
  )
}
