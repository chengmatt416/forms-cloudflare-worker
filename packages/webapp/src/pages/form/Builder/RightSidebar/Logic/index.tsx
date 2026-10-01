import type { FC } from 'react'

import { HiddenFields } from './HiddenFields'
import { Rules } from './Rules'
import { Variables } from './Variables'

export const Logic: FC = () => {
  return (
    <div className="divide-accent-light max-h-full min-h-0 space-y-4 divide-y overflow-x-hidden overflow-y-auto p-4">
      <HiddenFields />
      <Variables />
      <Rules />
    </div>
  )
}
