import { createFileRoute } from '@tanstack/react-router'
import { Stocktake } from '@/features/inventory/stocktake'

export const Route = createFileRoute('/_authenticated/kho/kiem-ke')({
  component: Stocktake,
})
