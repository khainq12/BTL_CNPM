import { createFileRoute } from '@tanstack/react-router'
import { Stock } from '@/features/inventory'

export const Route = createFileRoute('/_authenticated/kho/')({
  component: Stock,
})
