import { createFileRoute } from '@tanstack/react-router'
import { OnlineRequests } from '@/features/intake/online'

export const Route = createFileRoute('/_authenticated/tiep-nhan/online')({
  component: OnlineRequests,
})
