import { createFileRoute } from '@tanstack/react-router'
import { Approvals } from '@/features/approvals'

export const Route = createFileRoute('/_authenticated/phe-duyet')({
  component: Approvals,
})
