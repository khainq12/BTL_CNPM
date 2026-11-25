import { createFileRoute } from '@tanstack/react-router'
import { QcQueue } from '@/features/queues'

export const Route = createFileRoute('/_authenticated/kiem-dinh')({
  component: QcQueue,
})
