import {
  ActionEnum,
  Choice,
  ComparisonEnum,
  FieldKindEnum,
  LogicAction,
  LogicCondition,
  LogicPayload,
  Variable
} from '@heyform-inc/shared-types-enums'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { type FC, type ReactNode, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/utils'
import { helper, nanoid } from '@heyform-inc/utils'

import { Button, Form, Tooltip } from '@/components'
import { FormFieldType } from '@/types'

import Action from './Action'
import Condition from './Condition'

interface PayloadFormProps {
  form: any
  fields: FormFieldType[]
  currentField: FormFieldType
  variables?: Variable[]
  payloads: LogicPayload[]
  onFinish?: (values: any) => void
}

interface PayloadItemProps {
  fields: FormFieldType[]
  variables?: Variable[]
  currentField?: FormFieldType
  value?: LogicPayload
  onDelete?: () => void
  onChange?: (value: LogicPayload) => void
}

const NO_EXPECTED_COMPARISONS: any[] = [
  ComparisonEnum.IS_EMPTY,
  ComparisonEnum.IS_NOT_EMPTY,
  'is_empty',
  'is_not_empty'
]

function validateLogicPayload(payload: any): boolean {
  if (!payload?.action?.kind) {
    return false
  }

  const conditions = helper.isValidArray(payload.conditions)
    ? payload.conditions
    : payload.condition
      ? [payload.condition]
      : []

  if (conditions.length === 0) {
    return false
  }

  for (const cond of conditions) {
    if (!NO_EXPECTED_COMPARISONS.includes(cond.comparison) && helper.isEmpty(cond.expected)) {
      return false
    }
  }

  if (payload.action.kind === ActionEnum.NAVIGATE) {
    return helper.isValid(payload.action.fieldId)
  }

  return true
}

const validator = async (rule: any, value: any) => {
  if (!validateLogicPayload(value)) {
    throw new Error(rule.message as string)
  }
}

function getPayload(
  kind?: FieldKindEnum,
  choices: Choice[] = [],
  allowMultiple = false
): LogicPayload {
  const payload: any = {
    id: nanoid(12),
    condition: {},
    action: {
      kind: ActionEnum.NAVIGATE
    }
  }

  switch (kind) {
    case FieldKindEnum.SHORT_TEXT:
    case FieldKindEnum.LONG_TEXT:
    case FieldKindEnum.EMAIL:
    case FieldKindEnum.PHONE_NUMBER:
    case FieldKindEnum.URL:
    case FieldKindEnum.YES_NO:
    case FieldKindEnum.LEGAL_TERMS:
    case FieldKindEnum.DATE:
    case FieldKindEnum.MULTIPLE_CHOICE:
    case FieldKindEnum.PICTURE_CHOICE:
      payload.condition.comparison = ComparisonEnum.IS
      break

    case FieldKindEnum.NUMBER:
    case FieldKindEnum.RATING:
    case FieldKindEnum.OPINION_SCALE:
      payload.condition.comparison = ComparisonEnum.EQUAL
      break

    default:
      payload.condition.comparison = ComparisonEnum.IS_NOT_EMPTY
      break
  }

  if (FieldKindEnum.LEGAL_TERMS === kind) {
    payload.condition.expected = true
  } else if (FieldKindEnum.YES_NO === kind) {
    payload.condition.expected = choices[0]?.id
  } else if (FieldKindEnum.MULTIPLE_CHOICE === kind || FieldKindEnum.PICTURE_CHOICE === kind) {
    payload.condition.expected = allowMultiple ? [choices[0]?.id] : choices[0]?.id
  }

  payload.conditions = [payload.condition]
  payload.logicalOperator = 'and'

  return payload
}

export const PayloadItem: FC<PayloadItemProps> = ({
  fields,
  variables = [],
  currentField,
  value,
  onDelete,
  onChange
}) => {
  const { t } = useTranslation()

  const conditions = useMemo(() => {
    if (helper.isValidArray((value as any)?.conditions)) {
      return (value as any).conditions as LogicCondition[]
    }
    if (value?.condition) {
      return [value.condition]
    }
    return [getPayload(currentField?.kind).condition]
  }, [currentField?.kind, value])

  const logicalOperator: 'and' | 'or' | 'nor' = (value as any)?.logicalOperator || 'and'

  function handleOperatorChange(op: 'and' | 'or' | 'nor') {
    onChange?.({
      ...value,
      logicalOperator: op,
      conditions,
      condition: conditions[0]
    } as any)
  }

  function handleConditionChange(index: number, condition: LogicCondition) {
    const newConditions = [...conditions]
    newConditions[index] = condition
    onChange?.({
      ...value,
      conditions: newConditions,
      condition: newConditions[0]
    } as any)
  }

  function handleAddCondition() {
    const newCondition = getPayload(
      currentField?.kind,
      currentField?.properties?.choices,
      currentField?.properties?.allowMultiple
    ).condition

    const newConditions = [...conditions, newCondition]
    onChange?.({
      ...value,
      conditions: newConditions,
      condition: newConditions[0]
    } as any)
  }

  function handleDeleteCondition(index: number) {
    if (conditions.length <= 1) return
    const newConditions = conditions.filter((_, i) => i !== index)
    onChange?.({
      ...value,
      conditions: newConditions,
      condition: newConditions[0]
    } as any)
  }

  function handleActionChange(action: LogicAction) {
    onChange?.({
      ...value,
      conditions,
      condition: conditions[0],
      action
    } as any)
  }

  function handleDelete() {
    onDelete?.()
  }

  return (
    <div className="border-accent-light bg-foreground/60 rounded-xl border p-4 shadow-sm transition-all hover:border-slate-300">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          {/* Header for conditions match logic: Match ALL (AND) / ANY (OR) / NONE (NOR) */}
          <div className="border-accent-light/40 flex flex-wrap items-center justify-between gap-2 border-b pb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-secondary text-xs font-semibold tracking-wider uppercase">
                {t('form.builder.logic.rule.matchPrefix') || 'Match Logic'}:
              </span>
              <div className="border-accent-light bg-accent-light/30 inline-flex rounded-lg border p-0.5">
                <button
                  type="button"
                  className={cn(
                    'cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                    logicalOperator === 'and'
                      ? 'bg-foreground text-primary font-semibold shadow-sm'
                      : 'text-secondary hover:text-primary'
                  )}
                  onClick={() => handleOperatorChange('and')}
                >
                  {t('form.builder.logic.rule.matchAll') || 'ALL (AND)'}
                </button>
                <button
                  type="button"
                  className={cn(
                    'cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                    logicalOperator === 'or'
                      ? 'bg-foreground text-primary font-semibold shadow-sm'
                      : 'text-secondary hover:text-primary'
                  )}
                  onClick={() => handleOperatorChange('or')}
                >
                  {t('form.builder.logic.rule.matchAny') || 'ANY (OR)'}
                </button>
                <button
                  type="button"
                  className={cn(
                    'cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-all',
                    logicalOperator === 'nor'
                      ? 'bg-foreground text-primary font-semibold shadow-sm'
                      : 'text-secondary hover:text-primary'
                  )}
                  onClick={() => handleOperatorChange('nor')}
                >
                  {t('form.builder.logic.rule.matchNone') || 'NONE (NOR)'}
                </button>
              </div>
            </div>
            <span className="text-[11px] text-slate-500 italic">
              {logicalOperator === 'and'
                ? 'Triggers if all conditions are met'
                : logicalOperator === 'or'
                  ? 'Triggers if at least one condition is met'
                  : 'Triggers only if none of the conditions match'}
            </span>
          </div>

          {/* Condition list */}
          <div className="divide-accent-light/40 space-y-1 divide-y">
            {conditions.map((cond, idx) => (
              <Condition
                key={idx}
                field={currentField!}
                allFields={fields}
                variables={variables}
                value={cond}
                label={
                  idx === 0 ? (
                    t('form.builder.logic.rule.when')
                  ) : (
                    <button
                      type="button"
                      className="bg-accent-light/70 hover:bg-accent-light text-primary cursor-pointer rounded px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase transition-colors"
                      title="Click to toggle logic condition: AND / OR / NOR"
                      onClick={() =>
                        handleOperatorChange(
                          logicalOperator === 'and'
                            ? 'or'
                            : logicalOperator === 'or'
                              ? 'nor'
                              : 'and'
                        )
                      }
                    >
                      {logicalOperator.toUpperCase()}
                    </button>
                  )
                }
                canDelete={conditions.length > 1}
                onDelete={() => handleDeleteCondition(idx)}
                onChange={newCond => handleConditionChange(idx, newCond)}
              />
            ))}
          </div>

          {/* Add condition button */}
          <div className="pt-1">
            <Button.Link
              className="text-secondary hover:text-primary gap-1 text-xs"
              size="sm"
              onClick={handleAddCondition}
            >
              <IconPlus className="h-3.5 w-3.5" />
              {t('form.builder.logic.rule.addCondition') || 'Add condition'} (
              {logicalOperator.toUpperCase()})
            </Button.Link>
          </div>

          {/* Action */}
          <div className="border-accent-light/60 border-t pt-3">
            <Action
              fields={fields}
              currentField={currentField!}
              variables={variables}
              value={value?.action}
              onChange={handleActionChange}
            />
          </div>
        </div>

        <Tooltip label={t('form.builder.logic.rule.deleteRule')}>
          <Button.Link
            className="text-secondary hover:text-error"
            size="sm"
            iconOnly
            onClick={handleDelete}
          >
            <IconTrash className="h-5 w-5" />
          </Button.Link>
        </Tooltip>
      </div>
    </div>
  )
}

interface PayloadListProps extends PayloadItemProps {
  name: string
  className?: string
  children?: ReactNode
}

export const PayloadList: FC<PayloadListProps> = ({
  className,
  name,
  fields,
  variables = [],
  currentField,
  children
}) => {
  const { t } = useTranslation()

  return (
    <Form.List name={name}>
      {(listFields, { add, remove }) => {
        function handleAdd() {
          add(
            getPayload(
              currentField?.kind,
              currentField?.properties?.choices,
              currentField?.properties?.allowMultiple
            )
          )
        }

        return (
          <div className={className}>
            {children}

            {listFields.length > 0 && (
              <div className="mb-4 space-y-4">
                {listFields.map((listField, index) => {
                  function handleDelete() {
                    remove(index)
                  }

                  return (
                    <Form.Item
                      {...listField}
                      key={listField.key}
                      rules={[
                        {
                          required: true,
                          validator,
                          message: t('form.builder.logic.rule.required')
                        }
                      ]}
                    >
                      {({ value, onChange }) => {
                        return (
                          <PayloadItem
                            value={value}
                            fields={fields}
                            currentField={currentField}
                            variables={variables}
                            onDelete={handleDelete}
                            onChange={onChange}
                          />
                        )
                      }}
                    </Form.Item>
                  )
                })}
              </div>
            )}

            <Button.Ghost size="md" onClick={handleAdd}>
              <IconPlus className="text-secondary h-5 w-5" />
              {t('form.builder.logic.rule.addRule')}
            </Button.Ghost>
          </div>
        )
      }}
    </Form.List>
  )
}

export const PayloadForm: FC<PayloadFormProps> = ({
  form,
  fields,
  currentField,
  variables = [],
  payloads,
  onFinish
}) => {
  useEffect(() => {
    form.setFieldsValue({
      payloads
    })
  }, [currentField, payloads])

  return (
    <Form
      initialValues={{
        payloads
      }}
      form={form}
      onFinish={onFinish}
    >
      <PayloadList
        name="payloads"
        fields={fields}
        currentField={currentField}
        variables={variables}
      />
    </Form>
  )
}
