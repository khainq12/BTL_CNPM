import { createFileRoute } from '@tanstack/react-router'
import { Dispatch } from '@/features/dispatch'

export const Route = createFileRoute('/_authenticated/dieu-phoi')({
  component: Dispatch,
})
