import { createFileRoute } from '@tanstack/react-router'
import { Complaints } from '@/features/complaints'

export const Route = createFileRoute('/_authenticated/khieu-nai')({
  component: Complaints,
})
