import { useEffect, useMemo, useRef } from 'react'
import type { Attachment } from '../types/question'
import { cn } from './cn'

// 파일 → 미리보기 주소. 화면을 떠나면 주소를 해제한다.
function useObjectUrls(files: File[]) {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])
  return urls
}

// 사진 고르기 버튼 (숨긴 file input을 연다)
export function PhotoButton({ onPick, disabled }: { onPick: (files: File[]) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        aria-label="사진 첨부"
        title="사진 첨부"
        className="flex size-8 items-center justify-center rounded-full text-muted enabled:hover:bg-track enabled:hover:text-ink disabled:opacity-40"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="5" width="18" height="15" rx="3" />
          <circle cx="9" cy="11" r="2" />
          <path d="m21 16-5-5-9 9" />
        </svg>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          onPick(Array.from(e.target.files ?? []))
          e.target.value = '' // 같은 사진을 다시 골라도 동작하게
        }}
      />
    </>
  )
}

// 보내기 전 고른 사진 미리보기 (× 로 빼기)
export function PickedPhotos({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  const urls = useObjectUrls(files)
  if (files.length === 0) return null
  return (
    <div className="mb-2 flex gap-2 overflow-x-auto px-1 pt-1">
      {urls.map((url, i) => (
        <div key={url} className="relative shrink-0">
          <img src={url} alt={files[i].name} className="size-16 rounded-xl border border-line object-cover" />
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label={`${files[i].name} 빼기`}
            className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-ink text-[11px] leading-none text-white shadow"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

// 내가 보낸 말풍선 안의 사진 (보낸 직후, 아직 서버 주소가 없을 때)
export function SentPhotos({ files, className }: { files: File[]; className?: string }) {
  const urls = useObjectUrls(files)
  return (
    <div className={cn('flex flex-wrap justify-end gap-1.5', className)}>
      {urls.map((url, i) => (
        <img key={url} src={url} alt={files[i].name} className="size-24 rounded-2xl object-cover shadow-sm" />
      ))}
    </div>
  )
}

// 서버에 저장된 첨부파일 목록: 사진은 썸네일, 그 밖의 파일은 이름 링크. 누르면 원본을 내려받는다.
export function AttachmentList({ items, className }: { items: Attachment[] | undefined; className?: string }) {
  if (!items?.length) return null
  const images = items.filter((a) => a.mimeType.startsWith('image/'))
  const others = items.filter((a) => !a.mimeType.startsWith('image/'))
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((a) => (
            <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block">
              <img
                src={a.url}
                alt={a.name}
                loading="lazy"
                className="size-24 rounded-xl border border-line bg-track object-cover"
              />
            </a>
          ))}
        </div>
      )}
      {others.map((a) => (
        <a
          key={a.id}
          href={a.url}
          target="_blank"
          rel="noreferrer"
          className="self-start rounded-full border border-line px-3 py-1 text-caption text-ink hover:border-primary-200"
        >
          📎 {a.name}
        </a>
      ))}
    </div>
  )
}
