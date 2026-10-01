import { FieldKindEnum, LogicCondition, Variable } from '@heyform-inc/shared-types-enums'
import { IconTrash, IconWand } from '@tabler/icons-react'
import { type FC, type ReactNode, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { htmlUtils } from '@heyform-inc/answer-utils'
import { helper } from '@heyform-inc/utils'

import { Button, Input, RegexGeneratorModal, Select, Tooltip } from '@/components'
import {
  DATE_CONDITIONS,
  DEFAULT_COMPARISONS,
  MULTIPLE_CHOICE_CONDITIONS,
  NUMBER_CONDITIONS,
  SINGLE_CHOICE_CONDITIONS,
  TEXT_CONDITIONS,
  TRUE_FALSE_CONDITIONS
} from '@/consts'
import { FormFieldType } from '@/types'

import { QuestionIcon } from '../LeftSidebar/QuestionList'

interface ConditionProps {
  field: FormFieldType
  allFields?: FormFieldType[]
  variables?: Variable[]
  value?: LogicCondition
  label?: ReactNode
  canDelete?: boolean
  onDelete?: () => void
  onChange?: (value: LogicCondition) => void
}

interface DefaultProps {
  value?: any
  onComparisonChange: (value: any) => void
  onExpectedChange?: (value: any) => void
}

const NO_INPUT_COMPARISONS = ['is_empty', 'is_not_empty']

const DefaultCondition: FC<DefaultProps> = ({ value, onComparisonChange }) => {
  return (
    <Select
      className="w-auto min-w-[140px] flex-1"
      options={DEFAULT_COMPARISONS}
      value={value?.comparison}
      multiLanguage
      onChange={onComparisonChange}
    />
  )
}

const TextCondition: FC<DefaultProps> = ({ value, onComparisonChange, onExpectedChange }) => {
  const isNoInput = NO_INPUT_COMPARISONS.includes(value?.comparison)
  const isRegex = value?.comparison === 'matches_regex'
  const [isRegexModalOpen, setIsRegexModalOpen] = useState(false)

  return (
    <>
      <Select
        className="w-auto min-w-[140px] flex-1"
        options={TEXT_CONDITIONS}
        value={value?.comparison}
        multiLanguage
        onChange={onComparisonChange}
      />
      {!isNoInput && (
        <div className="flex min-w-[140px] flex-1 items-center gap-1.5">
          <Input
            className="flex-1"
            value={(value as Any).expected}
            placeholder={isRegex ? 'Regex pattern (e.g. ^VIP-)' : 'Value'}
            onChange={onExpectedChange}
          />
          {isRegex && (
            <button
              type="button"
              title="Open Regex Generator"
              className="text-primary-600 dark:text-primary-400 flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              onClick={() => setIsRegexModalOpen(true)}
            >
              <IconWand className="h-3.5 w-3.5" />
              <span>Regex</span>
            </button>
          )}
        </div>
      )}
      {isRegex && (
        <RegexGeneratorModal
          open={isRegexModalOpen}
          initialPattern={(value as Any)?.expected}
          onClose={() => setIsRegexModalOpen(false)}
          onApply={pattern => onExpectedChange?.(pattern)}
        />
      )}
    </>
  )
}

const SingleChoiceCondition: FC<DefaultProps & { field: FormFieldType }> = ({
  value,
  field,
  onComparisonChange,
  onExpectedChange
}) => {
  const isNoInput = NO_INPUT_COMPARISONS.includes(value?.comparison)

  return (
    <>
      <Select
        className="w-auto min-w-[140px] flex-1"
        options={SINGLE_CHOICE_CONDITIONS}
        value={value?.comparison}
        multiLanguage
        onChange={onComparisonChange}
      />
      {!isNoInput && (
        <Select
          className="min-w-[140px] flex-1"
          options={(field.properties?.choices || []) as AnyMap[]}
          valueKey="id"
          value={value?.expected}
          onChange={onExpectedChange}
        />
      )}
    </>
  )
}

const MultipleChoiceCondition: FC<DefaultProps & { field: FormFieldType }> = ({
  value,
  field,
  onComparisonChange,
  onExpectedChange
}) => {
  const isNoInput = NO_INPUT_COMPARISONS.includes(value?.comparison)

  const MemoSelect = useMemo(() => {
    if (isNoInput) {
      return null
    }

    if (field.properties?.allowMultiple && ['is', 'is_not'].includes(value?.comparison)) {
      const currValue = helper.isArray(value?.expected)
        ? value?.expected
        : [value?.expected].filter(helper.isValid)

      return (
        <Select.Multi
          className="min-w-[140px] flex-1"
          options={(field.properties?.choices || []) as AnyMap[]}
          valueKey="id"
          value={currValue}
          onChange={onExpectedChange}
        />
      )
    }

    const currValue = helper.isValidArray(value?.expected) ? value!.expected[0] : value?.expected

    return (
      <Select
        className="min-w-[140px] flex-1"
        options={(field.properties?.choices || []) as AnyMap[]}
        valueKey="id"
        value={currValue}
        onChange={onExpectedChange}
      />
    )
  }, [
    field.properties?.allowMultiple,
    field.properties?.choices,
    isNoInput,
    onExpectedChange,
    value?.comparison,
    value?.expected
  ])

  return (
    <>
      <Select
        className="w-auto min-w-[140px] flex-1"
        options={MULTIPLE_CHOICE_CONDITIONS}
        value={value?.comparison}
        multiLanguage
        onChange={onComparisonChange}
      />
      {MemoSelect}
    </>
  )
}

const BoolCondition: FC<DefaultProps> = ({ value, onComparisonChange, onExpectedChange }) => {
  const isNoInput = NO_INPUT_COMPARISONS.includes(value?.comparison)

  return (
    <>
      <Select
        className="w-auto min-w-[140px] flex-1"
        options={SINGLE_CHOICE_CONDITIONS}
        value={value?.comparison}
        multiLanguage
        onChange={onComparisonChange}
      />
      {!isNoInput && (
        <Select
          className="min-w-[140px] flex-1"
          type="boolean"
          options={TRUE_FALSE_CONDITIONS}
          value={value?.expected}
          multiLanguage
          onChange={onExpectedChange}
        />
      )}
    </>
  )
}

const DateCondition: FC<DefaultProps> = ({ value, onComparisonChange, onExpectedChange }) => {
  const isNoInput = NO_INPUT_COMPARISONS.includes(value?.comparison)
  const isBetween = value?.comparison === 'between'

  function handleBetweenChange(index: number, val: any) {
    const arr = Array.isArray(value?.expected) ? [...value.expected] : ['', '']
    arr[index] = val
    onExpectedChange?.(arr)
  }

  return (
    <>
      <Select
        className="w-auto min-w-[140px] flex-1"
        options={DATE_CONDITIONS}
        value={value?.comparison}
        multiLanguage
        onChange={onComparisonChange}
      />
      {!isNoInput && !isBetween && (
        <Input
          className="min-w-[140px] flex-1"
          type="date"
          value={(value as Any).expected}
          placeholder="Date"
          onChange={onExpectedChange}
        />
      )}
      {!isNoInput && isBetween && (
        <div className="flex min-w-[200px] flex-1 items-center gap-2">
          <Input
            type="date"
            placeholder="From"
            value={Array.isArray(value?.expected) ? value.expected[0] : ''}
            onChange={(val: any) => handleBetweenChange(0, val)}
          />
          <span className="text-secondary text-xs">to</span>
          <Input
            type="date"
            placeholder="To"
            value={Array.isArray(value?.expected) ? value.expected[1] : ''}
            onChange={(val: any) => handleBetweenChange(1, val)}
          />
        </div>
      )}
    </>
  )
}

const NumberCondition: FC<DefaultProps> = ({ value, onComparisonChange, onExpectedChange }) => {
  const { t } = useTranslation()
  const isNoInput = NO_INPUT_COMPARISONS.includes(value?.comparison)
  const isBetween = value?.comparison === 'between'

  function handleBetweenChange(index: number, val: any) {
    const arr = Array.isArray(value?.expected) ? [...value.expected] : ['', '']
    arr[index] = val !== '' && !isNaN(Number(val)) ? Number(val) : val
    onExpectedChange?.(arr)
  }

  return (
    <>
      <Select
        className="w-auto min-w-[140px] flex-1"
        options={NUMBER_CONDITIONS}
        value={value?.comparison}
        multiLanguage
        onChange={onComparisonChange}
      />
      {!isNoInput && !isBetween && (
        <Input
          className="min-w-[140px] flex-1"
          type="number"
          value={(value as Any).expected}
          placeholder="Value"
          onChange={onExpectedChange}
        />
      )}
      {!isNoInput && isBetween && (
        <div className="flex min-w-[180px] flex-1 items-center gap-2">
          <Input
            type="number"
            placeholder={t('form.builder.logic.rule.minValue') || 'Min'}
            value={Array.isArray(value?.expected) ? value.expected[0] : ''}
            onChange={(val: any) => handleBetweenChange(0, val)}
          />
          <span className="text-secondary text-xs">-</span>
          <Input
            type="number"
            placeholder={t('form.builder.logic.rule.maxValue') || 'Max'}
            value={Array.isArray(value?.expected) ? value.expected[1] : ''}
            onChange={(val: any) => handleBetweenChange(1, val)}
          />
        </div>
      )}
    </>
  )
}

function getDefaultComparisonForKind(kind?: FieldKindEnum): string {
  switch (kind) {
    case FieldKindEnum.NUMBER:
    case FieldKindEnum.RATING:
    case FieldKindEnum.OPINION_SCALE:
      return 'equal'
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
      return 'is'
    default:
      return 'is_not_empty'
  }
}

export default function Condition({
  field,
  allFields = [],
  value: rawValue,
  label,
  canDelete = false,
  onDelete,
  onChange
}: ConditionProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState<LogicCondition>(rawValue || ({} as any))

  const handleChange = useCallback(
    (newValue: any) => {
      setValue(newValue)
      onChange?.(newValue)
    },
    [onChange]
  )

  // Target field resolution: if fieldId is set, resolve from allFields; otherwise default to current field
  const targetFieldId = (value as any)?.fieldId || field.id
  const targetField = useMemo(() => {
    if (targetFieldId === field.id) {
      return field
    }
    return allFields.find(f => f.id === targetFieldId) || field
  }, [allFields, field, targetFieldId])

  const handleFieldChange = useCallback(
    (newFieldId: string) => {
      const selected = allFields.find(f => f.id === newFieldId) || field
      const defaultComp = getDefaultComparisonForKind(selected.kind)
      let defaultExpected: any

      if (selected.kind === FieldKindEnum.LEGAL_TERMS) {
        defaultExpected = true
      } else if (selected.kind === FieldKindEnum.YES_NO) {
        defaultExpected = selected.properties?.choices?.[0]?.id
      } else if (
        selected.kind === FieldKindEnum.MULTIPLE_CHOICE ||
        selected.kind === FieldKindEnum.PICTURE_CHOICE
      ) {
        defaultExpected = selected.properties?.allowMultiple
          ? [selected.properties?.choices?.[0]?.id]
          : selected.properties?.choices?.[0]?.id
      }

      handleChange({
        ...value,
        fieldId: newFieldId,
        comparison: defaultComp as any,
        expected: defaultExpected
      })
    },
    [allFields, field, handleChange, value]
  )

  const handleComparisonChange = useCallback(
    (comparison: any) => {
      handleChange({ ...value, comparison })
    },
    [handleChange, value]
  )

  const handleExpectedChange = useCallback(
    (expected: any) => {
      handleChange({ ...value, expected })
    },
    [handleChange, value]
  )

  // Question options for Cross-Field condition selection
  const questionOptions = useMemo(() => {
    const options: any[] = [
      {
        value: field.id,
        label: (
          <div className="flex items-center gap-x-2">
            <QuestionIcon kind={field.kind} index={field.index} parentIndex={field.parent?.index} />
            <span className="truncate">
              {t('form.builder.logic.rule.thisQuestion')}:{' '}
              {htmlUtils.plain(field.title as string) || 'Untitled'}
            </span>
          </div>
        )
      }
    ]

    allFields.forEach(f => {
      if (f.id !== field.id) {
        options.push({
          value: f.id,
          label: (
            <div className="flex items-center gap-x-2">
              <QuestionIcon kind={f.kind} index={f.index} parentIndex={f.parent?.index} />
              <span className="truncate">{htmlUtils.plain(f.title as string) || 'Untitled'}</span>
            </div>
          )
        })
      }
    })

    return options
  }, [allFields, field, t])

  const Element = useMemo(() => {
    switch (targetField.kind) {
      case FieldKindEnum.SHORT_TEXT:
      case FieldKindEnum.LONG_TEXT:
      case FieldKindEnum.EMAIL:
      case FieldKindEnum.PHONE_NUMBER:
      case FieldKindEnum.URL:
        return (
          <TextCondition
            value={value}
            onComparisonChange={handleComparisonChange}
            onExpectedChange={handleExpectedChange}
          />
        )

      case FieldKindEnum.YES_NO:
        return (
          <SingleChoiceCondition
            field={targetField}
            value={value}
            onComparisonChange={handleComparisonChange}
            onExpectedChange={handleExpectedChange}
          />
        )

      case FieldKindEnum.LEGAL_TERMS:
        return (
          <BoolCondition
            value={value}
            onComparisonChange={handleComparisonChange}
            onExpectedChange={handleExpectedChange}
          />
        )

      case FieldKindEnum.MULTIPLE_CHOICE:
      case FieldKindEnum.PICTURE_CHOICE:
        return (
          <MultipleChoiceCondition
            field={targetField}
            value={value}
            onComparisonChange={handleComparisonChange}
            onExpectedChange={handleExpectedChange}
          />
        )

      case FieldKindEnum.DATE:
        return (
          <DateCondition
            value={value}
            onComparisonChange={handleComparisonChange}
            onExpectedChange={handleExpectedChange}
          />
        )

      case FieldKindEnum.NUMBER:
      case FieldKindEnum.RATING:
      case FieldKindEnum.OPINION_SCALE:
        return (
          <NumberCondition
            value={value}
            onComparisonChange={handleComparisonChange}
            onExpectedChange={handleExpectedChange}
          />
        )

      default:
        return <DefaultCondition value={value} onComparisonChange={handleComparisonChange} />
    }
  }, [handleComparisonChange, handleExpectedChange, targetField, value])

  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      <div className="text-secondary flex w-14 shrink-0 items-center justify-start text-sm font-medium">
        {label || t('form.builder.logic.rule.when')}
      </div>

      {/* Target Question Selector */}
      <Select
        className="w-auto min-w-[180px] flex-1"
        options={questionOptions}
        value={targetFieldId}
        onChange={handleFieldChange}
      />

      {/* Operator and Expected Value */}
      {Element}

      {/* Delete Condition Button (if rule has > 1 condition) */}
      {canDelete && (
        <Tooltip label={t('form.builder.logic.rule.deleteCondition')}>
          <Button.Link
            className="text-secondary hover:text-error"
            size="sm"
            iconOnly
            onClick={onDelete}
          >
            <IconTrash className="h-4 w-4" />
          </Button.Link>
        </Tooltip>
      )}
    </div>
  )
}
