import { createFileRoute } from '@tanstack/react-router'
import { CaseDetail } from '@/features/cases/detail'

export const Route = createFileRoute('/_authenticated/phieu/$id')({
  component: function Page() {
    const { id } = Route.useParams()
    return <CaseDetail id={id} />
  },
})
