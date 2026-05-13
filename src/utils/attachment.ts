import { createAttachmentObjectUrl } from './attachmentStorage';

type OpenableAttachment = {
  url?: string;
  downloadUrl?: string;
  storageId?: string;
};

const DATA_URL_PATTERN = /^data:([^;,]*)(;base64)?,([\s\S]*)$/i;

const createBlobUrlFromDataUrl = (dataUrl: string) => {
  const matched = dataUrl.match(DATA_URL_PATTERN);
  if (!matched) return '';

  const mimeType = matched[1] || 'application/octet-stream';
  const isBase64 = Boolean(matched[2]);
  const payload = matched[3] || '';

  try {
    if (isBase64) {
      const binary = globalThis.atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }

      return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    }

    const decoded = decodeURIComponent(payload.replace(/\+/g, '%20'));
    return URL.createObjectURL(new Blob([decoded], { type: mimeType }));
  } catch {
    return '';
  }
};

export const openAttachmentUrl = (url: string) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const normalized = String(url || '').trim();
  if (!normalized) return;

  const previewUrl = normalized.startsWith('data:')
    ? createBlobUrlFromDataUrl(normalized) || normalized
    : normalized;

  const link = document.createElement('a');
  link.href = previewUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (previewUrl !== normalized && previewUrl.startsWith('blob:')) {
    window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
  }
};

export const openAttachmentRecord = async (attachment: OpenableAttachment) => {
  if (typeof window === 'undefined') return false;

  const directUrl = String(attachment?.url || attachment?.downloadUrl || '').trim();
  if (directUrl) {
    openAttachmentUrl(directUrl);
    return true;
  }

  const storageId = String(attachment?.storageId || '').trim();
  if (!storageId) return false;

  try {
    const objectUrl = await createAttachmentObjectUrl(storageId);
    if (!objectUrl) return false;
    openAttachmentUrl(objectUrl);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return true;
  } catch {
    return false;
  }
};
