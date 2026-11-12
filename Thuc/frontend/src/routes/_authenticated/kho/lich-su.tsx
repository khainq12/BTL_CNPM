import { createFileRoute } from '@tanstack/react-router'
import { StockHistory } from '@/features/inventory/history'

export const Route = createFileRoute('/_authenticated/kho/lich-su')({
  component: StockHistory,
})
