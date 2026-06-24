import { api } from './api'

export async function uploadFile(file: File, title: string, category = 'general'): Promise<{ id: string; file_url: string }> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('title', title)
  fd.append('category', category)
  const { data } = await api.post('/api/documents/upload', fd)
  return data
}
