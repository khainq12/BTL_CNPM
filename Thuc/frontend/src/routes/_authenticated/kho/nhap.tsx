import { createFileRoute } from '@tanstack/react-router'
import { StockIn } from '@/features/inventory/stock-in'

export const Route = createFileRoute('/_authenticated/kho/nhap')({
  component: StockIn,
})
