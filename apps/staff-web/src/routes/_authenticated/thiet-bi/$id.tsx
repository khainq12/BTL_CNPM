import { createFileRoute } from '@tanstack/react-router'
import { DeviceDetail } from '@/features/customers/device'

export const Route = createFileRoute('/_authenticated/thiet-bi/$id')({
  component: function Page() {
    const { id } = Route.useParams()
    return <DeviceDetail id={id} />
  },
})
