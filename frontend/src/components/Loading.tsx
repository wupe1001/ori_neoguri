// AI가 처리하는 동안 보여주는 안내
export default function Loading({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-muted">
      <span className="size-8 animate-spin rounded-full border-4 border-primary-100 border-t-primary-600" />
      <p>{message}</p>
    </div>
  )
}
