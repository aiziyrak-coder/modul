export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

const BLOB_READ_TIMEOUT_MS = 2_000;

export async function blobToText(blob: Blob): Promise<string | null> {
  const read = new Promise<string | null>((resolve) => {
    if (typeof blob.text === 'function') {
      blob
        .text()
        .then((text) => resolve(text))
        .catch(() => resolve(null));
      return;
    }
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsText(blob);
    } catch {
      resolve(null);
    }
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<string | null>((resolve) => {
    timer = setTimeout(() => resolve(null), BLOB_READ_TIMEOUT_MS);
  });
  try {
    return await Promise.race([read, guard]);
  } finally {
    clearTimeout(timer);
  }
}
