import { Fragment, type ReactNode } from 'react'
import { Dialog, Transition } from '@headlessui/react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  /** max-w-md (default) | max-w-2xl | max-w-4xl */
  maxWidth?: 'md' | '2xl' | '4xl'
}

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'md' }: ModalProps) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="overlay" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto overflow-x-hidden overscroll-contain">
          <div className="flex min-h-full items-center justify-center p-4 narrow:p-3 py-6 narrow:py-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel
                className={`modal w-full max-h-[calc(100vh-3rem)] min-h-0 flex flex-col overflow-hidden ${
                  maxWidth === '2xl' ? 'max-w-2xl' : maxWidth === '4xl' ? 'max-w-4xl' : 'max-w-md'
                }`}
              >
                <div className="flex-1 min-h-0 px-6 narrow:px-4 py-5 narrow:py-4 overflow-y-auto overflow-x-hidden">
                  {title && (
                    <Dialog.Title
                      className="text-base font-semibold mb-4 shrink-0"
                      style={{ color: 'var(--fg)' }}
                    >
                      {title}
                    </Dialog.Title>
                  )}
                  {children}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
