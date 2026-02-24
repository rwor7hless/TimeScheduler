import clsx from 'clsx'

export default function Spinner({ className }: { className?: string }) {
  return (
    <div className={clsx('flex items-center justify-center', className)}>
      <div className="w-8 h-8 border-3 border-gray-200 border-t-accent rounded-full animate-spin" />
    </div>
  )
}
