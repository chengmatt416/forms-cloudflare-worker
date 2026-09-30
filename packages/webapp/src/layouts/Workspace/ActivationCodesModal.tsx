import { IconCheck, IconCopy, IconPlus, IconTrash } from '@tabler/icons-react'
import { useAsyncEffect } from 'ahooks'
import dayjs from 'dayjs'
import { useState } from 'react'

import { ActivationCodeItem, AdminService } from '@/services'

import { Badge, Button, Loader, Modal, usePrompt, useToast } from '@/components'
import { useModal } from '@/store'

export default function ActivationCodesModal() {
  const { isOpen, onOpenChange } = useModal('ActivationCodesModal')
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [deletingCode, setDeletingCode] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [codes, setCodes] = useState<ActivationCodeItem[]>([])

  async function loadCodes() {
    setLoading(true)
    try {
      const result = await AdminService.activationCodes()
      setCodes(result || [])
    } catch (err: any) {
      toast({
        title: 'Error loading activation codes',
        message: err?.message || 'Failed to fetch activation codes'
      })
    } finally {
      setLoading(false)
    }
  }

  useAsyncEffect(async () => {
    if (isOpen) {
      await loadCodes()
    }
  }, [isOpen])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const code = await AdminService.generateActivationCode()
      toast({
        title: 'Activation Code Generated',
        message: `New code created: ${code}`
      })
      await loadCodes()
    } catch (err: any) {
      toast({
        title: 'Generation Failed',
        message: err?.message || 'Could not generate activation code'
      })
    } finally {
      setGenerating(false)
    }
  }

  async function handleDelete(code: string) {
    if (!window.confirm(`Are you sure you want to delete activation code "${code}"?`)) {
      return
    }
    setDeletingCode(code)
    try {
      await AdminService.deleteActivationCode(code)
      toast({
        title: 'Code Deleted',
        message: `Activation code ${code} was removed.`
      })
      setCodes(prev => prev.filter(c => c.code !== code))
    } catch (err: any) {
      toast({
        title: 'Delete Failed',
        message: err?.message || 'Could not delete activation code'
      })
    } finally {
      setDeletingCode(null)
    }
  }

  function handleCopy(code: string) {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => {
      setCopiedCode(prev => (prev === code ? null : prev))
    }, 2000)
    toast({
      title: 'Copied to Clipboard',
      message: code
    })
  }

  return (
    <Modal.Simple
      open={isOpen}
      title="Registration Activation Codes"
      description="Generate and manage activation codes required for new user registrations."
      onOpenChange={onOpenChange}
      contentProps={{
        className: 'max-w-2xl'
      }}
    >
      <div className="space-y-4 pt-2">
        <div className="border-accent-light flex items-center justify-between border-b pb-2">
          <div className="text-secondary text-sm">
            Total codes: <span className="text-primary font-semibold">{codes.length}</span>
          </div>
          <Button
            size="sm"
            loading={generating}
            onClick={handleGenerate}
            className="flex items-center gap-1.5"
          >
            <IconPlus size={16} />
            <span>Generate Code</span>
          </Button>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader />
          </div>
        ) : codes.length === 0 ? (
          <div className="text-secondary py-12 text-center text-sm">
            No activation codes found. Click &quot;Generate Code&quot; to create one.
          </div>
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {codes.map(c => {
              const isUsed = Boolean(c.usedBy)
              const isCopied = copiedCode === c.code

              return (
                <div
                  key={c.code}
                  className="border-accent-light hover:bg-accent-light/30 flex items-center justify-between rounded-lg border p-3 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-accent-light/50 text-primary rounded px-2 py-0.5 font-mono text-sm font-bold tracking-wide">
                        {c.code}
                      </span>
                      {isUsed ? (
                        <Badge color="zinc">Used</Badge>
                      ) : (
                        <Badge color="green">Available</Badge>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopy(c.code)}
                        className="text-secondary hover:text-primary rounded p-1 transition-colors"
                        title="Copy code"
                      >
                        {isCopied ? (
                          <IconCheck size={16} className="text-green-600" />
                        ) : (
                          <IconCopy size={16} />
                        )}
                      </button>
                    </div>

                    <div className="text-secondary text-xs">
                      {isUsed ? (
                        <span>
                          Used by <span className="text-primary font-medium">{c.usedBy}</span>
                          {c.usedAt && <> &middot; {dayjs(c.usedAt).format('YYYY-MM-DD HH:mm')}</>}
                        </span>
                      ) : (
                        <span>Created on {dayjs(c.createdAt).format('YYYY-MM-DD HH:mm')}</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <Button.Ghost
                      size="sm"
                      loading={deletingCode === c.code}
                      className="text-error hover:bg-error/10 hover:text-error"
                      onClick={() => handleDelete(c.code)}
                      title="Delete code"
                    >
                      <IconTrash size={16} />
                    </Button.Ghost>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Modal.Simple>
  )
}
