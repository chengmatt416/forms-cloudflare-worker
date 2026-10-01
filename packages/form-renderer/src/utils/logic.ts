import {
  ActionEnum,
  AnswerValue,
  CalculateEnum,
  ChoiceValue,
  ComparisonEnum,
  FieldKindEnum,
  FormField,
  Logic,
  LogicAction,
  LogicCondition,
  LogicPayload,
  NavigateAction,
  NumberCalculateAction,
  QUESTION_FIELD_KINDS,
  STATEMENT_FIELD_KINDS,
  StringCalculateAction,
  Variable
} from '@heyform-inc/shared-types-enums'

import { helper } from '@heyform-inc/utils'

import type { IFormField } from '../typings'

export interface EnhancedLogicPayload {
  id: string
  condition?: LogicCondition
  conditions?: LogicCondition[]
  logicalOperator?: 'and' | 'or' | 'nor'
  action: LogicAction
  actions?: LogicAction[]
}

export interface PickAndCalcFieldsResult {
  fields: IFormField[]
  variables: Record<string, AnswerValue>
}

const NO_LOGIC_FIELD_KINDS = [...STATEMENT_FIELD_KINDS, FieldKindEnum.GROUP]

export function isNumber(arg: any): boolean {
  return Number.isFinite(arg)
}

export function isEqual(arg1: unknown, arg2: unknown): boolean {
  if (helper.isArray(arg1) && helper.isArray(arg2)) {
    return (
      (arg1 as any[]).length === (arg2 as any[]).length &&
      (arg1 as any[]).every(e => (arg2 as any[]).includes(e))
    )
  }
  return String(arg1) === String(arg2)
}

export function isContains(arg1: unknown, arg2: unknown): boolean {
  if (helper.isArray(arg1)) {
    if (helper.isArray(arg2)) {
      return (arg2 as any[]).some(e => (arg1 as any[]).includes(String(e)))
    }
    return (arg1 as any[]).includes(String(arg2))
  }
  return String(arg1).includes(String(arg2))
}

export function isStartsWith(arg1: unknown, arg2: unknown): boolean {
  return String(arg1).startsWith(String(arg2))
}

export function isEndsWith(arg1: unknown, arg2: unknown): boolean {
  return String(arg1).endsWith(String(arg2))
}

export function isGreaterThan(arg1: unknown, arg2: unknown): boolean {
  return helper.isNumeric(arg1) && helper.isNumeric(arg2) && Number(arg1) > Number(arg2)
}

export function isLessThan(arg1: unknown, arg2: unknown): boolean {
  return helper.isNumeric(arg1) && helper.isNumeric(arg2) && Number(arg1) < Number(arg2)
}

export function isGreaterOrEqualThan(arg1: unknown, arg2: unknown): boolean {
  return helper.isNumeric(arg1) && helper.isNumeric(arg2) && Number(arg1) >= Number(arg2)
}

export function isLessOrEqualThan(arg1: unknown, arg2: unknown): boolean {
  return helper.isNumeric(arg1) && helper.isNumeric(arg2) && Number(arg1) <= Number(arg2)
}

function parseDateMs(val: any): number | null {
  if (helper.isNil(val) || val === '') {
    return null
  }
  const d = new Date(val)
  const ms = d.getTime()
  return isNaN(ms) ? null : ms
}

export function isBetween(val: unknown, expected: unknown): boolean {
  if (helper.isNil(val) || helper.isNil(expected)) {
    return false
  }

  let min: any
  let max: any

  if (Array.isArray(expected)) {
    min = expected[0]
    max = expected[1]
  } else if (typeof expected === 'string') {
    const parts = expected.split(',').map(s => s.trim())
    min = parts[0]
    max = parts[1]
  }

  if (helper.isNil(min) || helper.isNil(max)) {
    return false
  }

  if (helper.isNumeric(val) && helper.isNumeric(min) && helper.isNumeric(max)) {
    const num = Number(val)
    return num >= Number(min) && num <= Number(max)
  }

  // Date comparison
  const dVal = parseDateMs(val)
  const dMin = parseDateMs(min)
  const dMax = parseDateMs(max)

  if (dVal !== null && dMin !== null && dMax !== null) {
    return dVal >= dMin && dVal <= dMax
  }

  return false
}

export function matchesRegex(val: unknown, pattern: unknown): boolean {
  if (helper.isNil(val) || helper.isNil(pattern)) {
    return false
  }
  try {
    const reg = new RegExp(String(pattern))
    return reg.test(String(val))
  } catch {
    return false
  }
}

export function isSameDate(value: string, expected: string): boolean {
  const d1 = parseDateMs(value)
  const d2 = parseDateMs(expected)
  if (d1 === null || d2 === null) return false
  return new Date(d1).toDateString() === new Date(d2).toDateString()
}

export function isBeforeDate(value: string, expected: string): boolean {
  const d1 = parseDateMs(value)
  const d2 = parseDateMs(expected)
  if (d1 === null || d2 === null) return false
  return d1 < d2
}

export function isAfterDate(value: string, expected: string): boolean {
  const d1 = parseDateMs(value)
  const d2 = parseDateMs(expected)
  if (d1 === null || d2 === null) return false
  return d1 > d2
}

export function validateSingleCondition(
  field: FormField,
  condition: LogicCondition,
  values?: Record<string, AnswerValue>,
  allFields?: FormField[],
  variables?: Record<string, AnswerValue>
): boolean {
  const condAny = condition as any
  // Support Cross-Field condition evaluation
  const targetFieldId = condAny.fieldId || field.id
  const targetField =
    targetFieldId !== field.id && allFields
      ? allFields.find(f => f.id === targetFieldId) || field
      : field

  // Variable condition check
  const variableId = condAny.variableId
  let val: any

  if (variableId && variables) {
    val = variables[variableId]
  } else {
    val = values?.[targetFieldId]
  }

  const comparison = String(condition.comparison)
  const expected = condAny.expected

  // Common is_empty / is_not_empty
  if (comparison === 'is_empty') {
    return helper.isEmpty(val)
  }
  if (comparison === 'is_not_empty') {
    return !helper.isEmpty(val)
  }

  // Advanced: between & regex
  if (comparison === 'between') {
    return isBetween(val, expected)
  }
  if (comparison === 'matches_regex') {
    return matchesRegex(val, expected)
  }

  if (NO_LOGIC_FIELD_KINDS.includes(targetField.kind)) {
    return false
  }

  switch (targetField.kind) {
    case FieldKindEnum.SHORT_TEXT:
    case FieldKindEnum.LONG_TEXT:
    case FieldKindEnum.PHONE_NUMBER:
    case FieldKindEnum.EMAIL:
    case FieldKindEnum.URL: {
      switch (comparison) {
        case ComparisonEnum.IS:
        case 'is':
          return isEqual(val, expected)
        case ComparisonEnum.IS_NOT:
        case 'is_not':
          return !isEqual(val, expected)
        case ComparisonEnum.CONTAINS:
        case 'contains':
          return isContains(val, expected)
        case ComparisonEnum.DOES_NOT_CONTAIN:
        case 'does_not_contain':
          return !isContains(val, expected)
        case ComparisonEnum.STARTS_WITH:
        case 'starts_with':
          return isStartsWith(val, expected)
        case ComparisonEnum.ENDS_WITH:
        case 'ends_with':
          return isEndsWith(val, expected)
      }
      return false
    }

    case FieldKindEnum.MULTIPLE_CHOICE:
    case FieldKindEnum.PICTURE_CHOICE: {
      const rawValue = val as ChoiceValue
      const allowMultiple = helper.isTrue(targetField.properties?.allowMultiple)
      const expArray = helper.isArray(expected) ? expected : [expected]
      const choiceValue = [...(rawValue?.value || []), rawValue?.other].filter(helper.isValid)

      switch (comparison) {
        case ComparisonEnum.IS:
        case 'is':
          return isEqual(choiceValue, expArray)
        case ComparisonEnum.IS_NOT:
        case 'is_not':
          return !isEqual(choiceValue, expArray)
        case ComparisonEnum.CONTAINS:
        case 'contains':
          return allowMultiple && isContains(choiceValue, expArray)
        case ComparisonEnum.DOES_NOT_CONTAIN:
        case 'does_not_contain':
          return allowMultiple && !isContains(choiceValue, expArray)
      }
      return false
    }

    case FieldKindEnum.YES_NO:
    case FieldKindEnum.LEGAL_TERMS: {
      switch (comparison) {
        case ComparisonEnum.IS:
        case 'is':
          return isEqual(val, expected)
        case ComparisonEnum.IS_NOT:
        case 'is_not':
          return !isEqual(val, expected)
      }
      return false
    }

    case FieldKindEnum.DATE: {
      switch (comparison) {
        case ComparisonEnum.IS:
        case 'is':
          return isSameDate(val, expected)
        case ComparisonEnum.IS_NOT:
        case 'is_not':
          return !isSameDate(val, expected)
        case ComparisonEnum.IS_BEFORE:
        case 'is_before':
          return isBeforeDate(val, expected)
        case ComparisonEnum.IS_AFTER:
        case 'is_after':
          return isAfterDate(val, expected)
      }
      return false
    }

    case FieldKindEnum.NUMBER:
    case FieldKindEnum.RATING:
    case FieldKindEnum.OPINION_SCALE: {
      switch (comparison) {
        case ComparisonEnum.EQUAL:
        case 'equal':
          return isEqual(val, expected)
        case ComparisonEnum.NOT_EQUAL:
        case 'not_equal':
          return !isEqual(val, expected)
        case ComparisonEnum.GREATER_THAN:
        case 'greater_than':
          return isGreaterThan(val, expected)
        case ComparisonEnum.LESS_THAN:
        case 'less_than':
          return isLessThan(val, expected)
        case ComparisonEnum.GREATER_OR_EQUAL_THAN:
        case 'greater_or_equal_than':
          return isGreaterOrEqualThan(val, expected)
        case ComparisonEnum.LESS_OR_EQUAL_THAN:
        case 'less_or_equal_than':
          return isLessOrEqualThan(val, expected)
      }
      return false
    }

    default:
      return false
  }
}

export function evaluatePayloadConditions(
  payload: LogicPayload | EnhancedLogicPayload,
  field: FormField,
  values?: Record<string, AnswerValue>,
  allFields?: FormField[],
  variables?: Record<string, AnswerValue>
): boolean {
  const pAny = payload as any
  const conditions: LogicCondition[] = helper.isValidArray(pAny.conditions)
    ? pAny.conditions
    : pAny.condition
      ? [pAny.condition]
      : []

  if (conditions.length === 0) {
    return false
  }

  const op = pAny.logicalOperator || 'and'

  if (op === 'or') {
    return conditions.some((c: LogicCondition) =>
      validateSingleCondition(field, c, values, allFields, variables)
    )
  }

  if (op === 'nor' || op === 'not') {
    return !conditions.some((c: LogicCondition) =>
      validateSingleCondition(field, c, values, allFields, variables)
    )
  }

  return conditions.every((c: LogicCondition) =>
    validateSingleCondition(field, c, values, allFields, variables)
  )
}

function calculateString(
  value: string,
  action: StringCalculateAction,
  values?: Record<string, AnswerValue>
): string {
  let newValue = action.value as string
  if (action.ref) {
    newValue = values?.[action.ref] as string
  }
  if (!helper.isNil(newValue)) {
    switch (action.operator) {
      case CalculateEnum.ADDITION:
        return (value || '') + newValue
      case CalculateEnum.ASSIGNMENT:
        return newValue
    }
  }
  return value
}

function calculateNumber(
  value: number,
  action: NumberCalculateAction,
  values?: Record<string, AnswerValue>
): number {
  let newValue = action.value as number
  if (action.ref) {
    newValue = values?.[action.ref] as number
  }
  if (!helper.isNil(newValue) && isNumber(newValue)) {
    switch (action.operator) {
      case CalculateEnum.ADDITION:
        return (Number(value) || 0) + Number(newValue)
      case CalculateEnum.SUBTRACTION:
        return (Number(value) || 0) - Number(newValue)
      case CalculateEnum.MULTIPLICATION:
        return (Number(value) || 0) * Number(newValue)
      case CalculateEnum.DIVISION:
        return Number(newValue) !== 0 ? (Number(value) || 0) / Number(newValue) : value
      case CalculateEnum.ASSIGNMENT:
        return Number(newValue)
    }
  }
  return value
}

export function calculateAction(
  action: NumberCalculateAction | StringCalculateAction,
  parameters?: Variable[],
  data?: Record<string, string | number>,
  values?: Record<string, AnswerValue>
): Record<string, any> {
  if (helper.isEmpty(parameters) || helper.isEmpty(data) || helper.isNil(data![action.variable])) {
    return data || {}
  }
  const variable = parameters!.find(v => v.id === action.variable)
  if (!variable) {
    return data || {}
  }
  let current = data![action.variable]

  switch (variable.kind) {
    case 'string':
      current = calculateString(current as string, action as StringCalculateAction, values)
      break
    case 'number':
      current = calculateNumber(current as number, action as NumberCalculateAction, values)
      break
  }

  return {
    ...data,
    [action.variable]: current
  }
}

function indexFields(fields: IFormField[]) {
  const parents = fields.filter(f => !f.parent && QUESTION_FIELD_KINDS.includes(f.kind))
  const children = fields.filter(f => f.parent && QUESTION_FIELD_KINDS.includes(f.kind))

  let index = 1
  const childrenIndexes: Record<string, number> = {}

  parents.forEach(f => {
    f.index = index++
  })

  children.forEach(f => {
    const parentId = f.parent!.id
    const parent = parents.find(p => p.id === parentId)

    if (!childrenIndexes[parentId]) {
      childrenIndexes[parentId] = 1
    }

    f.parent = parent
    f.index = childrenIndexes[parentId]++
  })
}

export function validateRequiredField(field: FormField, values?: Record<string, any>): boolean {
  if (!field.validations?.required) {
    return true
  }
  return !helper.isEmpty(values?.[field.id])
}

export function applyEnhancedLogicToFields(
  fields?: IFormField[],
  logics?: Logic[],
  parameters?: Variable[],
  values?: Record<string, AnswerValue>
): PickAndCalcFieldsResult {
  const result: PickAndCalcFieldsResult = {
    fields: [],
    variables: {}
  }

  if (helper.isEmpty(fields)) {
    return result
  }

  if (helper.isValid(parameters)) {
    for (const variable of parameters!) {
      result.variables[variable.id] = variable.value
    }
  }

  if (helper.isEmpty(logics) || helper.isEmpty(values)) {
    indexFields(fields!)
    return {
      ...result,
      fields: fields!.filter(f => f.kind !== FieldKindEnum.THANK_YOU)
    }
  }

  let index = 0

  while (index < fields!.length) {
    const field = fields![index]

    if (field.kind === FieldKindEnum.THANK_YOU) {
      break
    }

    let isNavigateValidated = false
    const logic = logics!.find(l => l.fieldId === field.id)

    if (field.parent && result.fields.findIndex(f => f.id === field.parent!.id) < 0) {
      result.fields.push(field.parent)
    }

    if (logic) {
      const { payloads } = logic

      // 1. Calculate actions
      const calculates = payloads.filter(p => p.action.kind === ActionEnum.CALCULATE)
      for (const calculate of calculates) {
        const isValidated = evaluatePayloadConditions(
          calculate,
          field,
          values,
          fields,
          result.variables
        )
        if (isValidated) {
          result.variables = calculateAction(
            calculate.action as NumberCalculateAction | StringCalculateAction,
            parameters,
            result.variables,
            values
          )
        }
      }

      // 2. Navigate actions
      const navigates = payloads.filter(p => p.action.kind === ActionEnum.NAVIGATE)
      for (const navigate of navigates) {
        field.isTouched = evaluatePayloadConditions(
          navigate,
          field,
          values,
          fields,
          result.variables
        )

        if (field.isTouched) {
          const jumpFieldId = (navigate.action as NavigateAction).fieldId
          const jumpIndex = fields!.findIndex(f => f.id === jumpFieldId)
          const isExists = !!result.fields.find(f => f.id === jumpFieldId)

          if (!isExists && jumpIndex > index) {
            index = jumpIndex
            isNavigateValidated = true
            result.fields.push(field)
            break
          }
        } else {
          field.isTouched = validateRequiredField(field, values)
        }
      }
    }

    if (!isNavigateValidated) {
      index += 1
      result.fields.push(field)
    }
  }

  indexFields(result.fields)
  return result
}
