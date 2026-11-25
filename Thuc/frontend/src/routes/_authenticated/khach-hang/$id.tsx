import { createFileRoute } from '@tanstack/react-router'
import { CustomerDetail } from '@/features/customers/detail'

export const Route = createFileRoute('/_authenticated/khach-hang/$id')({
  component: function Page() {
    const { id } = Route.useParams()
    return <CustomerDetail id={id} />
  },
})
