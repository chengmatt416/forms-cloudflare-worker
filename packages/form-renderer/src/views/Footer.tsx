import { IconChevronDown, IconChevronUp, IconLayoutGrid } from '@tabler/icons-react'
import type { FC } from 'react'

import { useTranslation } from '../utils'

import { Button, Tooltip } from '../components'
import { useStore } from '../store'
import { Branding } from './Branding'

export const Footer: FC = () => {
  const { state, dispatch } = useStore()
  const { t } = useTranslation()

  function handlePrevious() {
    dispatch({ type: 'scrollPrevious' })
  }

  function handleNext() {
    dispatch({ type: 'scrollNext' })
  }

  function handleToggleSidebar() {
    dispatch({
      type: 'setIsSidebarOpen',
      payload: {
        isSidebarOpen: !state.isSidebarOpen
      }
    })
  }

  const currentIndex = (state.scrollIndex ?? 0) + 1
  const totalQuestions = state.fields?.length || 0

  return (
    <div className="heyform-footer">
      <div className="heyform-footer-wrapper">
        {/* Mobile ergonomic bottom dock */}
        <div className="heyform-footer-mobile md:hidden">
          <div className="heyform-mobile-dock">
            {state.enableNavigationArrows !== false && (
              <button
                type="button"
                className="heyform-mobile-nav-btn"
                disabled={state.scrollIndex! < 1}
                onClick={handlePrevious}
                aria-label={t('Previous question')}
              >
                <IconChevronUp className="h-5 w-5" />
              </button>
            )}

            <div className="heyform-mobile-counter">
              <span>{currentIndex}</span>
              <span className="opacity-40">/</span>
              <span>{totalQuestions}</span>
            </div>

            {state.enableNavigationArrows !== false && (
              <button
                type="button"
                className="heyform-mobile-nav-btn"
                disabled={
                  state.isScrollNextDisabled || state.scrollIndex! >= state.fields.length - 1
                }
                onClick={handleNext}
                aria-label={t('Next question')}
              >
                <IconChevronDown className="h-5 w-5" />
              </button>
            )}

            {state.enableQuestionList && (
              <button
                type="button"
                className="heyform-mobile-nav-btn heyform-mobile-list-btn"
                onClick={handleToggleSidebar}
                aria-label={t('Questions')}
              >
                <IconLayoutGrid className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Desktop navigation & branding (Preserved & Optimized) */}
        <div className="heyform-footer-left hidden md:flex"></div>

        <div className="heyform-footer-right hidden md:flex">
          <div className="heyform-pagination">
            {state.enableQuestionList && (
              <Tooltip ariaLabel={t('Questions')}>
                <Button.Link
                  className="heyform-sidebar-toggle"
                  leading={<IconLayoutGrid />}
                  onClick={handleToggleSidebar}
                />
              </Tooltip>
            )}

            {state.enableNavigationArrows !== false && (
              <>
                <Tooltip ariaLabel={t('Previous question')}>
                  <Button.Link
                    className="heyform-pagination-previous"
                    leading={<IconChevronUp />}
                    disabled={state.scrollIndex! < 1}
                    onClick={handlePrevious}
                  />
                </Tooltip>

                <Tooltip ariaLabel={t('Next question')}>
                  <Button.Link
                    className="heyform-pagination-next"
                    leading={<IconChevronDown />}
                    disabled={
                      state.isScrollNextDisabled || state.scrollIndex! >= state.fields.length - 1
                    }
                    onClick={handleNext}
                  />
                </Tooltip>
              </>
            )}
          </div>

          <Branding />
        </div>
      </div>
    </div>
  )
}
