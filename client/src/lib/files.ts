import type { UploadedFile } from '@shared/types'
import { API_URL, ApiError, getToken } from './api'

// Uploading files to our own storage (server/src/files.ts): profile photos and, later, chat photos and PDFs.
//
//   const file = await uploadFile(picked, { kind: 'avatar' })
//   const file = await uploadFile(picked, { kind: 'chat', trip: inviteCode })
//   <img src={fileSrc(file.url)} />
//
// Throws an ApiError with a message that can be shown to the user.

export type UploadTarget = { kind: 'avatar' } | { kind: 'chat' | 'stay'; trip: string }

// The longest side of a photo after it is made smaller. A phone photo of 4000 px and 4 MB becomes
// about 200–400 KB, which matters because all files share the free database's 512 MB.
const MAX_SIDE = { avatar: 512, chat: 1600, stay: 1600 } as const
const JPEG_QUALITY = 0.85

// Our files are on the server (Render), not on Vercel, so the address needs the server in front
export const fileSrc = (url: string) => (url.startsWith('/') ? API_URL + url : url)

export async function uploadFile(file: File, target: UploadTarget): Promise<UploadedFile> {
  const body = await shrinkPhoto(file, MAX_SIDE[target.kind])
  const query = target.kind === 'avatar' ? '?kind=avatar' : `?kind=${target.kind}&trip=${encodeURIComponent(target.trip)}`
  const token = getToken()
  let res: Response
  try {
    res = await fetch(`${API_URL}/api/files${query}`, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': body.type || 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    })
  } catch {
    throw new ApiError('You are offline — please try again', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error ?? `${res.status} ${res.statusText}`, res.status)
  return data as UploadedFile
}

// A JPG, PNG or WebP photo larger than maxSide is drawn smaller and saved as JPG.
// GIFs (they may move), PDFs and photos that are already small enough are sent as they are,
// and so is a photo the browser cannot draw: the server then decides whether it takes it.
export async function shrinkPhoto(file: File, maxSide: number): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file
  let bitmap: ImageBitmap
  try {
    // from-image: a phone photo taken sideways is turned the right way first
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size < 1024 * 1024) { bitmap.close(); return file }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) { bitmap.close(); return file }
  // JPG has no transparency: a transparent PNG gets a white background instead of a black one
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  return blob && blob.size < file.size ? blob : file
}
