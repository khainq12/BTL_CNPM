import { createFileRoute } from '@tanstack/react-router'
import { HandoverQueue } from '@/features/queues'

export const Route = createFileRoute('/_authenticated/ban-giao')({
  component: HandoverQueue,
})
