import { useState } from 'react'
import { ImageIcon, ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Photo } from '@/domain/types'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

// Ảnh hiện trạng và ảnh kiểm tra.
// Bản chạy thử: nén trên trình duyệt (cạnh dài ≤ 1280 px, JPEG) rồi lưu kèm phiếu dạng data URL.
// Bản thật: gửi tệp đã nén lên API upload của TV4, phiếu chỉ giữ đường dẫn trả về.

const MAX_EDGE = 1280
const QUALITY = 0.72
const MAX_INPUT = 15 * 1024 * 1024

async function compress(file: File): Promise<Photo> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return { name: file.name.replace(/\.[^.]+$/, '') + '.jpg', src: canvas.toDataURL('image/jpeg', QUALITY) }
}

export function PhotoPicker({
  value,
  onChange,
  error,
  label = 'Ảnh hiện trạng',
  required = true,
  hint = 'Chụp mặt trước, mặt sau và các vết trầy, móp. Tối đa 8 ảnh.',
  max = 8,
}: {
  value: Photo[]
  onChange: (p: Photo[]) => void
  error?: string | false
  label?: string
  required?: boolean
  hint?: string
  max?: number
}) {
  const [busy, setBusy] = useState(0)
  const [view, setView] = useState<number | null>(null)

  async function pick(files: File[]) {
    const room = max - value.length
    const tooBig = files.filter((f) => f.size > MAX_INPUT).length
    const ok = files.filter((f) => f.size <= MAX_INPUT && f.type.startsWith('image/')).slice(0, Math.max(0, room))
    if (tooBig) toast.error(`${tooBig} ảnh lớn hơn 15 MB, đã bỏ qua.`)
    if (files.length - tooBig > ok.length) toast.error(`Chỉ nhận tối đa ${max} ảnh.`)
    if (!ok.length) return
    setBusy(ok.length)
    const out: Photo[] = []
    for (const f of ok) {
      try {
        out.push(await compress(f))
      } catch {
        toast.error(`Không đọc được ảnh ${f.name}. Thử chụp lại hoặc chọn tệp JPG/PNG.`)
      }
    }
    setBusy(0)
    onChange([...value, ...out])
  }

  return (
    <fieldset className='grid gap-2'>
      <legend className={`mb-1 text-sm font-medium ${error ? 'text-destructive' : ''}`}>
        {label}
        {required && <span className='text-destructive'>*</span>}
      </legend>
      <div className='flex flex-wrap gap-3'>
        {value.map((p, i) => (
          <div key={i} className='relative size-24 overflow-hidden rounded-md border'>
            <button type='button' className='size-full' onClick={() => setView(i)} aria-label={`Xem ảnh ${i + 1}`}>
              <Thumb photo={p} />
            </button>
            <button type='button' aria-label={`Xóa ảnh ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))} className='bg-background/90 absolute end-1 top-1 rounded-full p-0.5 shadow-sm'>
              <X className='size-3.5' />
            </button>
          </div>
        ))}
        {Array.from({ length: busy }, (_, i) => (
          <div key={`b${i}`} className='text-muted-foreground flex size-24 items-center justify-center rounded-md border' aria-label='Đang xử lý ảnh'>
            <Loader2 className='size-5 animate-spin' />
          </div>
        ))}
        {value.length + busy < max && (
          <label className='hover:bg-accent text-muted-foreground focus-within:ring-ring/50 flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs focus-within:ring-[3px]'>
            <ImagePlus className='size-5' aria-hidden />
            Thêm ảnh
            <input
              type='file'
              accept='image/*'
              capture='environment'
              multiple
              className='sr-only'
              disabled={busy > 0}
              onChange={(e) => {
                pick(Array.from(e.target.files ?? []))
                e.target.value = ''
              }}
            />
          </label>
        )}
      </div>
      <p className={error ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'}>{error || hint}</p>
      <PhotoViewer photos={value} index={view} onIndex={setView} />
    </fieldset>
  )
}

function Thumb({ photo }: { photo: Photo }) {
  return photo.src ? (
    <img src={photo.src} alt={photo.name} className='size-full object-cover' />
  ) : (
    <span className='bg-muted text-muted-foreground flex size-full flex-col items-center justify-center gap-1 p-1 text-center text-[11px] break-all'>
      <ImageIcon className='size-4' aria-hidden />
      {photo.name}
    </span>
  )
}

function PhotoViewer({ photos, index, onIndex }: { photos: Photo[]; index: number | null; onIndex: (i: number | null) => void }) {
  const p = index === null ? undefined : photos[index]
  return (
    <Dialog open={!!p} onOpenChange={(o) => !o && onIndex(null)}>
      <DialogContent className='sm:max-w-3xl'>
        <DialogTitle className='text-base'>
          Ảnh {index! + 1}/{photos.length}
        </DialogTitle>
        <DialogDescription className='sr-only'>{p?.name}</DialogDescription>
        {p?.src ? (
          <img src={p.src} alt={p.name} className='max-h-[70vh] w-full rounded-md object-contain' />
        ) : (
          <p className='text-muted-foreground text-sm'>Ảnh mẫu "{p?.name}" chỉ có tên tệp, không có nội dung.</p>
        )}
        {photos.length > 1 && (
          <div className='flex justify-between gap-2'>
            <button type='button' className='text-sm underline underline-offset-4 disabled:opacity-40' disabled={index === 0} onClick={() => onIndex(index! - 1)}>
              Ảnh trước
            </button>
            <button type='button' className='text-sm underline underline-offset-4 disabled:opacity-40' disabled={index === photos.length - 1} onClick={() => onIndex(index! + 1)}>
              Ảnh sau
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Hiển thị ảnh đã lưu trên phiếu (chỉ xem).
export function PhotoGallery({ photos }: { photos: Photo[] }) {
  const [view, setView] = useState<number | null>(null)
  if (!photos.length) return <span>Chưa có</span>
  return (
    <>
      <div className='flex flex-wrap gap-2'>
        {photos.map((p, i) => (
          <button key={i} type='button' onClick={() => setView(i)} className='focus-visible:ring-ring/50 size-16 overflow-hidden rounded-md border outline-none focus-visible:ring-[3px]' aria-label={`Xem ảnh ${i + 1}: ${p.name}`}>
            <Thumb photo={p} />
          </button>
        ))}
      </div>
      <PhotoViewer photos={photos} index={view} onIndex={setView} />
    </>
  )
}
