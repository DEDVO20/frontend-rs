import { api } from './api'

export async function uploadFile(file: File, title: string, category = 'general'): Promise<{ id: string; file_url: string }> {
  // 1. Get signed upload URL from backend
  const { data: urlData } = await api.post('/api/documents/upload-url', {
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
  })

  // 2. Upload directly to Supabase Storage
  const uploadRes = await fetch(urlData.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })

  if (!uploadRes.ok) {
    throw new Error('Error al subir archivo a Storage')
  }

  // 3. Confirm upload with backend (creates document record)
  const { data: doc } = await api.post('/api/documents/confirm-upload', {
    path: urlData.path,
    title,
    category,
    fileName: file.name,
    fileSize: file.size,
    contentType: file.type || 'application/octet-stream',
  })

  return doc
}
