import type { FormField, NavigateAction } from '@heyform-inc/shared-types-enums'
import { ActionEnum, FieldKindEnum, NumberPrice } from '@heyform-inc/shared-types-enums'
import { IconChevronRight } from '@tabler/icons-react'
import Big from 'big.js'
import clsx from 'clsx'
import type { FormProps as RCFormProps } from 'rc-field-form'
import RCForm, { Field, useForm } from 'rc-field-form'
import { FC, ReactNode, useEffect, useMemo, useState } from 'react'

import {
  applyEnhancedLogicToFields as applyLogicToFields,
  evaluatePayloadConditions,
  getNavigateFieldId,
  sendMessageToParent,
  sliceFieldsByLogics,
  useEnterKey,
  useTranslation,
  validateAdvancedValue,
  validateLogicField
} from '../utils'
import { validateFields } from '@heyform-inc/answer-utils'
import { clone, helper } from '@heyform-inc/utils'

import { Submit } from '../components'
import { removeStorage, useStore } from '../store'

interface FormProps extends RCFormProps {
  field: FormField
  autoSubmit?: boolean
  isSubmitShow?: boolean
  hideSubmitIfErrorOccurred?: boolean
  getValues?: (values: any) => any
  children?: ReactNode
}

const NextIcon = <IconChevronRight />

export const Form: FC<FormProps> = ({
  field,
  autoSubmit: rawAutoSubmit = false,
  isSubmitShow: rawSubmitShow = true,
  validateTrigger: trigger,
  hideSubmitIfErrorOccurred = false,
  getValues,
  children,
  ...restProps
}) => {
  const [form] = useForm<any>()
  const { t } = useTranslation()
  const { state, dispatch } = useStore()
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string>()

  const autoSubmit = useMemo(
    () => (state.alwaysShowNextButton ? false : rawAutoSubmit),
    [rawAutoSubmit, state.alwaysShowNextButton]
  )

  const validateTrigger = trigger ? trigger : autoSubmit ? 'onChange' : 'onSubmit'
  const isLastBlock = useMemo(
    () => state.scrollIndex! >= state.fields.length - 1,
    [state.fields.length, state.scrollIndex]
  )

  const initialValues = getValues ? getValues(restProps.initialValues) : restProps.initialValues
  const isSubmitShow = useMemo(
    () => rawSubmitShow || state.alwaysShowNextButton,
    [rawSubmitShow, state.alwaysShowNextButton]
  )
  const submitVisible = useMemo(
    () =>
      hideSubmitIfErrorOccurred && !isSubmitShow
        ? false
        : helper.isValid(initialValues) || isSubmitShow,
    [initialValues, isSubmitShow, hideSubmitIfErrorOccurred]
  )

  const isSkippable = useMemo(() => {
    return !field.validations?.required && field.kind !== 'statement' && field.kind !== 'group'
  }, [])

  async function handleFinish(formValue: any) {
    const value = getValues ? getValues(formValue) : formValue

    if (helper.isValid(value)) {
      dispatch({
        type: 'setValues',
        payload: {
          values: {
            [field.id]: value
          }
        }
      })
    }

    const values = { ...state.values, [field.id]: value }

    const curAdvError = validateAdvancedValue(field, value, t)
    if (curAdvError) {
      setSubmitError(curAdvError)
      return
    }

    const isTouched = validateLogicField(field, state.jumpFieldIds, values)
    const isPartialSubmission = state.isScrollNextDisabled && !isTouched
    const isSubmitting = isLastBlock || state.isScrollNextDisabled

    if (isSubmitting) {
      if (loading) {
        return
      }

      dispatch({
        type: 'setIsSubmitTouched',
        payload: {
          isSubmitTouched: true
        }
      })

      setSubmitError(undefined)

      const fields =
        isPartialSubmission || !isLastBlock
          ? sliceFieldsByLogics(state.fields, state.jumpFieldIds)
          : state.fields

      try {
        validateFields(fields, values)
        for (const f of fields) {
          const advError = validateAdvancedValue(f, values[f.id], t)
          if (advError) {
            throw {
              message: advError,
              response: { id: f.id }
            }
          }
        }
        setLoading(true)

        if (state.stripe) {
          const paymentField = state.fields.find(f => f.kind === FieldKindEnum.PAYMENT)

          if (paymentField) {
            const value = values[paymentField.id]

            if (helper.isValid(value)) {
              const price = paymentField.properties?.price as NumberPrice
              const currency = paymentField.properties?.currency

              if (!helper.isValid(price?.value) || price.value <= 0 || !helper.isValid(currency)) {
                values[paymentField.id] = undefined
              } else {
                values[paymentField.id] = {
                  amount: Big(price.value).times(100).toNumber(),
                  currency,
                  billingDetails: {
                    name: value.name
                  }
                }
              }
            }
          }
        }

        // Submit form
        await state.onSubmit?.(values, isPartialSubmission, state.stripe)

        if (helper.isTrue(state.query.hideAfterSubmit)) {
          sendMessageToParent('HIDE_EMBED_MODAL')
        }

        setLoading(false)

        const { variables } = applyLogicToFields(
          clone([...state.allFields, ...state.thankYouFields].filter(Boolean) as FormField[]),
          state.logics,
          state.parameters,
          values
        )

        const thankYouFieldId = getNavigateFieldId(
          field,
          state.thankYouFields,
          state.logics,
          state.parameters,
          values,
          variables
        )

        dispatch({
          type: 'setIsSubmitted',
          payload: {
            isSubmitted: true,
            thankYouFieldId: thankYouFieldId || state.thankYouFields[0]?.id
          }
        })

        // Clear storage cache
        removeStorage(state.formId)
      } catch (err: any) {
        console.error(err, err?.response)
        setLoading(false)

        if (helper.isValid(err?.response?.id)) {
          dispatch({
            type: 'scrollToField',
            payload: {
              fieldId: err?.response?.id,
              errorFieldId: err?.response?.id
            }
          })
        } else {
          setSubmitError(err?.message)
        }
      }

      return
    }

    if (state.isSubmitTouched) {
      try {
        validateFields(state.fields, values)
        for (const f of state.fields) {
          const advError = validateAdvancedValue(f, values[f.id], t)
          if (advError) {
            throw {
              message: advError,
              response: { id: f.id }
            }
          }
        }
      } catch (err: any) {
        console.error(err, err?.response)
        dispatch({
          type: 'scrollToField',
          payload: {
            fieldId: err.response?.id,
            errorFieldId: err?.response?.id
          }
        })

        return
      }
    }

    // Check if current field triggers a logic navigate jump (including jumping back to previous questions or to thank-you screens)
    if (state.logics) {
      const logic = state.logics.find(l => l.fieldId === field.id)
      if (logic) {
        const navigates = logic.payloads.filter(p => p.action.kind === ActionEnum.NAVIGATE)
        for (const navigate of navigates) {
          const isMatched = evaluatePayloadConditions(
            navigate,
            field,
            values,
            state.allFields,
            state.variables
          )
          if (isMatched) {
            const jumpFieldId = (navigate.action as NavigateAction).fieldId
            const thankYouField = state.thankYouFields.find(f => f.id === jumpFieldId)
            if (thankYouField) {
              setLoading(true)
              try {
                await state.onSubmit?.(values, true, state.stripe)
              } catch (err: any) {
                console.error('Failed to submit form on thank-you jump:', err)
              } finally {
                setLoading(false)
              }
              dispatch({
                type: 'setIsSubmitted',
                payload: {
                  isSubmitted: true,
                  thankYouFieldId: jumpFieldId
                }
              })
              removeStorage(state.formId)
              return
            }
            dispatch({
              type: 'scrollToField',
              payload: {
                fieldId: jumpFieldId
              }
            })
            return
          }
        }
      }
    }

    // Navigate to next form field
    dispatch({ type: 'scrollNext' })
  }

  function handleValuesChange(changes: any, values: any) {
    restProps.onValuesChange?.(changes, values)

    if (autoSubmit) {
      if (isLastBlock) {
        const value = getValues ? getValues(changes) : changes

        if (helper.isValid(value)) {
          dispatch({
            type: 'setValues',
            payload: {
              values: {
                [field.id]: value
              }
            }
          })
        }
      } else {
        setTimeout(() => form.submit(), 500)
      }

      return
    }

    // Rc-field-form doesn't provide any way to clear errors,
    // so it can only be done in the following disgraceful way.
    // see https://github.com/ant-design/ant-design/issues/24599#issuecomment-653292811
    Object.keys(values).forEach(name => {
      const error = form.getFieldError(name)

      if (error.length > 0) {
        form.setFields([
          {
            name,
            errors: []
          }
        ])
      }
    })
  }

  function handleSkip() {
    dispatch({ type: 'scrollNext' })
  }

  useEnterKey(`heyform-${state.instanceId}-${field.id}`, (event: KeyboardEvent) => {
    if (window.heyform.device.mobile) {
      return event.preventDefault()
    }

    form.submit()
  })

  useEffect(() => {
    if (field.id === state.errorFieldId) {
      form.validateFields()
    }
  }, [state.errorFieldId])

  return (
    <RCForm
      className={clsx('heyform-form', {
        'heyform-form-last': isLastBlock
      })}
      autoComplete="off"
      form={form}
      validateTrigger={validateTrigger}
      onValuesChange={handleValuesChange}
      onFinish={handleFinish}
      {...restProps}
    >
      {children}

      {/* Submit */}
      {isLastBlock || state.isScrollNextDisabled ? (
        <>
          {submitError && (
            <div className="heyform-validation-wrapper">
              <div className="heyform-validation-error">{submitError}</div>
            </div>
          )}
          <Field shouldUpdate={true}>
            <Submit text={t('Submit')} loading={loading} />
          </Field>
        </>
      ) : (
        <div className="mt-8 flex items-center gap-2">
          {submitVisible && (
            <Field shouldUpdate={true}>
              {state.alwaysShowNextButton ? (
                <Submit
                  className="!mt-0"
                  text={field.properties?.buttonText || t('Next')}
                  icon={NextIcon}
                />
              ) : (
                (_, __, { getFieldsError }) => {
                  return (
                    !getFieldsError().some(({ errors }) => errors.length) && (
                      <Submit
                        className="!mt-0"
                        text={field.properties?.buttonText || t('Next')}
                        icon={NextIcon}
                      />
                    )
                  )
                }
              )}
            </Field>
          )}
          {isSkippable && (
            <button className="heyform-skip-button" onClick={handleSkip}>
              {t('Skip')}
            </button>
          )}
        </div>
      )}
    </RCForm>
  )
}
