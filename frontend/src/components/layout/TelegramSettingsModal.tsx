import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { telegramApi } from '@/api/telegram'
import toast from 'react-hot-toast'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function TelegramSettingsModal({ isOpen, onClose }: Props) {
  const [key, setKey] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['telegram-status'],
    queryFn: telegramApi.status,
    enabled: isOpen,
  })

  const connected = data?.connected ?? false

  useEffect(() => {
    if (!isOpen) setKey('')
  }, [isOpen])

  const connectMutation = useMutation({
    mutationFn: () => telegramApi.connect(key.trim()),
    onSuccess: () => {
      toast.success('Telegram подключён!')
      queryClient.invalidateQueries({ queryKey: ['telegram-status'] })
      setKey('')
    },
    onError: () => {
      toast.error('Ключ не найден. Проверьте правильность.')
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: telegramApi.disconnect,
    onSuccess: () => {
      toast.success('Telegram отключён')
      queryClient.invalidateQueries({ queryKey: ['telegram-status'] })
    },
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Telegram напоминания" maxWidth="md">
      <div className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-gray-500">Загрузка...</p>
        ) : connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Telegram подключён
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Вы будете получать напоминания о задачах прямо в Telegram.
            </p>
            <Button
              variant="danger"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
            >
              Отключить
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-300 font-medium mb-1">Как подключить:</p>
              <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
                <li>Откройте бота в Telegram</li>
                <li>Отправьте команду <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">/start</code></li>
                <li>Скопируйте полученный ключ</li>
                <li>Вставьте его ниже</li>
              </ol>
            </div>
            <Input
              label="Ключ от бота"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Вставьте ключ здесь..."
            />
            <Button
              onClick={() => connectMutation.mutate()}
              disabled={!key.trim() || connectMutation.isPending}
            >
              Подключить
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
