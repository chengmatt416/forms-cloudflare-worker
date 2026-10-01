import { ActionEnum, ComparisonEnum, LogicPayload } from '@heyform-inc/shared-types-enums'

import { helper } from '@heyform-inc/utils'

const NO_EXPECTED_COMPARISONS = [
  ComparisonEnum.IS_EMPTY,
  ComparisonEnum.IS_NOT_EMPTY,
  'is_empty',
  'is_not_empty'
]

export function validatePayload(payload: LogicPayload): boolean {
  if (!payload.action?.kind) {
    return false
  }

  const pAny = payload as any
  const conditions = helper.isValidArray(pAny.conditions)
    ? pAny.conditions
    : pAny.condition
      ? [pAny.condition]
      : []

  if (conditions.length === 0) {
    return false
  }

  for (const cond of conditions) {
    if (
      !NO_EXPECTED_COMPARISONS.includes(cond.comparison) &&
      helper.isEmpty((cond as any).expected)
    ) {
      return false
    }
  }

  if (payload.action.kind === ActionEnum.NAVIGATE) {
    return helper.isValid(payload.action.fieldId)
  }

  return (
    helper.isValid(payload.action.variable) &&
    helper.isValid(payload.action.operator) &&
    helper.isValid(payload.action.value)
  )
}
