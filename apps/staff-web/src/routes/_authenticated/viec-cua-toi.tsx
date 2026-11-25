import { createFileRoute } from '@tanstack/react-router'
import { MyWork } from '@/features/my-work'

export const Route = createFileRoute('/_authenticated/viec-cua-toi')({
  component: MyWork,
})
