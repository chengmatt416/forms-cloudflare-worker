import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { htmlUtils } from '@heyform-inc/answer-utils'

import { Button, Form, Modal } from '@/components'
import { useAppStore, useModal } from '@/store'

import { QuestionIcon } from '../LeftSidebar/QuestionList'
import { useStoreContext } from '../store'
import { PayloadForm } from './PayloadForm'

const LogicComponent = () => {
  const { t } = useTranslation()

  const [rcForm] = Form.useForm()
  const { closeModal } = useAppStore()
  const { state, dispatch } = useStoreContext()
  const { fields, currentField, logics } = state

  const payloads = useMemo(() => {
    return logics?.find(l => l.fieldId === currentField?.id)?.payloads || []
  }, [currentField, logics])

  function handleClose() {
    closeModal('LogicModal')
  }

  function handleRemoveAll() {
    dispatch({
      type: 'deleteLogic',
      payload: {
        fieldId: state.currentField!.id
      }
    })
  }

  function handleSave() {
    rcForm.submit()
  }

  function handleFinish({ payloads }: AnyMap) {
    handleClose()
    dispatch({
      type: 'setLogic',
      payload: {
        fieldId: state.currentField!.id,
        payloads
      }
    })
  }

  return (
    <div className="flex h-[75vh] max-h-[85vh] flex-col overflow-hidden">
      <div className="border-accent-light shrink-0 border-b p-4">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">
          {t('form.builder.logic.rule.headline')}
        </h2>

        {currentField && (
          <div className="mt-2 flex min-w-0 flex-1 items-center justify-between gap-x-2">
            <QuestionIcon
              kind={currentField.kind}
              index={currentField.index}
              parentIndex={currentField.parent?.index}
            />
            <div className="min-w-0 flex-1 truncate font-medium text-slate-700 dark:text-slate-300">
              {htmlUtils.plain(currentField.title as string)}
            </div>
          </div>
        )}
      </div>

      <div className="scrollbar min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto p-4">
        <PayloadForm
          form={rcForm}
          fields={fields}
          currentField={currentField!}
          payloads={payloads}
          variables={state.variables}
          onFinish={handleFinish}
        />
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <Button.Link size="md" className="text-error" onClick={handleRemoveAll}>
          {t('form.builder.logic.rule.removeAll')}
        </Button.Link>

        <div className="flex items-center">
          <Button.Ghost size="md" onClick={handleClose}>
            {t('components.cancel')}
          </Button.Ghost>
          <Button className="ml-4" size="md" onClick={handleSave}>
            {t('components.saveChanges')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function LogicModal() {
  const { isOpen, onOpenChange } = useModal('LogicModal')

  return (
    <Modal
      open={isOpen}
      contentProps={{
        className: 'max-w-4xl p-0 overflow-hidden'
      }}
      onOpenChange={onOpenChange}
    >
      <LogicComponent />
    </Modal>
  )
}
