import { useEffect, useMemo } from 'react'
import { ImagePlus, X } from 'lucide-react'

// Ảnh hiện trạng. Bản thật upload qua backend/MinIO (chờ TV4 chốt), ở đây chỉ giữ tên tệp.
export function PhotoPicker({ files, onChange, error }: { files: File[]; onChange: (f: File[]) => void; error?: string | false }) {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])
  return (
    <fieldset className='grid gap-2'>
      <legend className={`mb-1 text-sm font-medium ${error ? 'text-destructive' : ''}`}>
        Ảnh hiện trạng<span className='text-destructive'>*</span>
      </legend>
      <div className='flex flex-wrap gap-3'>
        {files.map((f, i) => (
          <div key={f.name + i} className='relative size-24 overflow-hidden rounded-md border'>
            <img src={urls[i]} alt={`Ảnh hiện trạng ${i + 1}`} className='size-full object-cover' />
            <button type='button' aria-label={`Xóa ảnh ${i + 1}`} onClick={() => onChange(files.filter((_, j) => j !== i))} className='bg-background/90 absolute end-1 top-1 rounded-full p-0.5 shadow-sm'>
              <X className='size-3.5' />
            </button>
          </div>
        ))}
        <label className='hover:bg-accent text-muted-foreground focus-within:ring-ring/50 flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs focus-within:ring-[3px]'>
          <ImagePlus className='size-5' aria-hidden />
          Thêm ảnh
          <input
            type='file'
            accept='image/*'
            capture='environment'
            multiple
            className='sr-only'
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []).filter((f) => f.size <= 10 * 1024 * 1024)
              onChange([...files, ...picked].slice(0, 8))
              e.target.value = ''
            }}
          />
        </label>
      </div>
      <p className={error ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'}>{error || 'Chụp mặt trước, mặt sau và các vết trầy, móp. Tối đa 8 ảnh, mỗi ảnh ≤ 10 MB.'}</p>
    </fieldset>
  )
}
