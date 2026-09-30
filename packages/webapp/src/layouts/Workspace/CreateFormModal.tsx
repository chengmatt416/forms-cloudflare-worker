import { FormKindEnum, InteractiveModeEnum } from '@heyform-inc/shared-types-enums'
import { IconPlus, IconStack2 } from '@tabler/icons-react'
import { useRequest } from 'ahooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FormService } from '@/services'
import { useParam, useRouter } from '@/utils'

import IconAI from '@/assets/ai.svg?react'
import { Button, Modal, useToast } from '@/components'
import { useAppStore, useModal, useWorkspaceStore } from '@/store'

import CreateWithAIModel from './CreateWithAIModel'
import TemplatesModel from './TemplatesModel'

const FORM_TYPES = [
  {
    id: 'ai',
    headline: 'form.creation.ai.headline',
    subHeadline: 'form.creation.ai.subHeadline',
    icon: IconAI
  },
  {
    id: 'scratch',
    headline: 'form.creation.scratch.headline',
    subHeadline: 'form.creation.scratch.subHeadline',
    icon: IconPlus
  },
  {
    id: 'template',
    headline: 'form.creation.template.headline',
    subHeadline: 'form.creation.template.subHeadline',
    icon: IconStack2
  }
]

const CreateFormComponent = () => {
  const { t } = useTranslation()

  const router = useRouter()
  const { workspaceId, projectId } = useParam()
  const { closeModal } = useAppStore()
  const { workspace, project } = useWorkspaceStore()
  const toast = useToast()

  const [activeName, setActiveName] = useState<string>()

  const targetProjectId = projectId || project?.id || workspace?.projects?.[0]?.id
  const targetWorkspaceId = workspaceId || workspace?.id

  const { loading, run } = useRequest(
    async () => {
      try {
        const formId = await FormService.create({
          projectId: targetProjectId,
          name: t('form.creation.defaultName'),
          nameSchema: [],
          interactiveMode: InteractiveModeEnum.GENERAL,
          kind: FormKindEnum.SURVEY
        })

        closeModal('CreateFormModal')
        let finalProjectId = targetProjectId
        let finalWorkspaceId = targetWorkspaceId
        if (!finalProjectId || !finalWorkspaceId) {
          const detail = await FormService.detail(formId)
          finalProjectId = finalProjectId || detail?.projectId
          finalWorkspaceId = finalWorkspaceId || detail?.teamId
        }
        router.push(
          `/workspace/${finalWorkspaceId}/project/${finalProjectId}/form/${formId}/create`
        )
      } catch (err: any) {
        toast({
          title: t('components.error.title'),
          message: err?.message || 'Failed to create form'
        })
      }
    },
    {
      refreshDeps: [targetProjectId, targetWorkspaceId, t],
      manual: true
    }
  )

  function handleClick(name: string) {
    switch (name) {
      case 'scratch':
        run()
        break

      case 'ai':
        setActiveName(name)
        break

      default:
        setActiveName(name)
        break
    }
  }

  function handleBack() {
    setActiveName(undefined)
  }

  if (activeName === 'template') {
    return <TemplatesModel onBack={handleBack} />
  } else if (activeName === 'ai') {
    return <CreateWithAIModel onBack={handleBack} />
  } else {
    return (
      <>
        <h2 className="text-primary text-xl/6 font-semibold text-balance sm:text-lg/6">
          {t('form.creation.headline')}
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:w-[42rem] sm:grid-cols-3">
          {FORM_TYPES.map(row => (
            <Button.Link
              key={row.id}
              className="border-input flex h-auto border py-8 sm:aspect-square sm:h-auto sm:py-0 [&_[data-slot=button]]:h-full [&_[data-slot=button]]:flex-col"
              loading={row.id === 'scratch' && loading}
              disabled={loading}
              onClick={() => handleClick(row.id)}
            >
              <row.icon className="non-scaling-stroke h-9 w-9" />
              <div className="mt-2 text-sm/6 font-semibold">{t(row.headline)}</div>
              <div className="text-secondary mt-1 text-xs">{t(row.subHeadline)}</div>
            </Button.Link>
          ))}
        </div>
      </>
    )
  }
}

export default function CreateFormModal() {
  const { isOpen, onOpenChange } = useModal('CreateFormModal')

  return (
    <Modal
      open={isOpen}
      contentProps={{
        id: 'create-form-modal',
        className: 'sm:max-w-full sm:max-h-[90vh] w-auto'
      }}
      onOpenChange={onOpenChange}
    >
      <CreateFormComponent />
    </Modal>
  )
}
