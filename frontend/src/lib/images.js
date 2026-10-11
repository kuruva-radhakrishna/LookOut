import { api } from './api'

const OK_TYPES = /^image\/(jpeg|png|webp)$/

/** Phones take 5-10 MB photos; shrink anything large in the browser before it is uploaded. */
export async function prepareImage(file, { max = 1600, quality = 0.85 } = {}) {
  if (!OK_TYPES.test(file.type)) throw new Error(`${file.name}: use a JPG, PNG or WebP image`)
  if (file.size < 600 * 1024) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : file
  } catch {
    return file // can't decode here: let the server judge it
  }
}

/** Uploads files to the API; resolves to [{ url, filename }] in the same order. */
export async function uploadImages(files) {
  const prepared = []
  for (const f of files) prepared.push(await prepareImage(f))
  const form = new FormData()
  prepared.forEach((f) => form.append('images', f))
  return api.post('/media', form)
}

export const isHttpUrl = (s) => {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
