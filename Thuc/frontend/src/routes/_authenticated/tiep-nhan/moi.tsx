import { createFileRoute } from '@tanstack/react-router'
import { IntakeCreate } from '@/features/intake'

export const Route = createFileRoute('/_authenticated/tiep-nhan/moi')({
  component: IntakeCreate,
})
