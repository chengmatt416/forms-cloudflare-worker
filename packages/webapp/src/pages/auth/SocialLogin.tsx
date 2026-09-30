import { IconBrandAppleFilled, IconLock } from '@tabler/icons-react'
import { FC, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { getDeviceId, useRouter } from '@/utils'

import IconGoogle from '@/assets/google.svg?react'
import { Button, Divider } from '@/components'
import {
  DISABLE_LOGIN_WITH_APPLE,
  DISABLE_LOGIN_WITH_GOOGLE,
  DISABLE_LOGIN_WITH_OIDC,
  DISABLE_LOGIN_WITH_PASSWORD,
  OIDC_DISPLAY_NAME,
  isRegistrationDisabled
} from '@/consts'

interface SocialLoginProps {
  isSignUp?: boolean
}

const SocialIcon: FC<{ children: ReactNode }> = ({ children }) => (
  <span className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center">
    {children}
  </span>
)

const SocialLogin: FC<SocialLoginProps> = () => {
  return null
}

export default SocialLogin
