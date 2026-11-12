import { createFileRoute } from '@tanstack/react-router'
import { PartRequests } from '@/features/inventory/requests'

export const Route = createFileRoute('/_authenticated/kho/yeu-cau')({
  component: PartRequests,
})
