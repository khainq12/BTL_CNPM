import { createFileRoute } from '@tanstack/react-router'
import { CaseList } from '@/features/cases/list'

export const Route = createFileRoute('/_authenticated/phieu/')({
  component: CaseList,
})
