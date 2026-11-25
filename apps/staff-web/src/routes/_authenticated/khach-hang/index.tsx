import { createFileRoute } from '@tanstack/react-router'
import { Customers } from '@/features/customers'

export const Route = createFileRoute('/_authenticated/khach-hang/')({
  component: Customers,
})
