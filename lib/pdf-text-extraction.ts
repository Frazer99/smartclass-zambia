'use client';

type ProgressCallback = (progress: number) => void;

type TesseractBrowser = {
  createWorker: (language: string, oem: number, options: {
    workerPath: string;
    corePath: string;
    langPath: string;
    logger: (message: { progress?: number }) => void;
  }) => Promise<{
    recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
    terminate: () => Promise<unknown>;
  }>;
};

function cleanExtractedText(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

async function loadTesseract(): Promise<TesseractBrowser> {
  const existing = (window as Window & { Tesseract?: TesseractBrowser }).Tesseract;
  if (existing) return existing;

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the local OCR engine.'));
    document.head.appendChild(script);
  });

  const tesseract = (window as Window & { Tesseract?: TesseractBrowser }).Tesseract;
  if (!tesseract) throw new Error('The local OCR engine did not initialize.');
  return tesseract;
}

/**
 * Extracts selectable text locally first, then OCRs image-only PDF pages in
 * the browser. Returns null only when the caller should use server fallback.
 */
export async function extractPdfTextLocally(file: File, onProgress?: ProgressCallback): Promise<string | null> {
  const [{ getDocument, GlobalWorkerOptions }] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
  ]);

  GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
  const pdf = await getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  }).promise;
  const selectablePages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .trim();
    selectablePages.push(pageText);
    onProgress?.(Math.round((pageNumber / pdf.numPages) * 30));
  }

  const weakPageNumbers = selectablePages
    .map((pageText, index) => pageText.length < 20 ? index + 1 : null)
    .filter((pageNumber): pageNumber is number => pageNumber !== null);
  if (selectablePages.length === 0) {
    return null;
  }
  if (weakPageNumbers.length === 0) {
    onProgress?.(100);
    return cleanExtractedText(selectablePages.join('\n\f\n'));
  }

  const { createWorker } = await loadTesseract();
  const worker = await createWorker('eng', 1, {
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm.js',
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    logger: (message) => {
      if (typeof message.progress === 'number') {
        onProgress?.(30 + Math.round(message.progress * 70));
      }
    },
  });

  try {
    const extractedPages = [...selectablePages];
    for (const pageNumber of weakPageNumbers) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.6 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not create a canvas for local OCR.');
      await page.render({ canvasContext: context, viewport }).promise;
      const result = await worker.recognize(canvas);
      extractedPages[pageNumber - 1] = result.data.text;
      canvas.width = 1;
      canvas.height = 1;
      onProgress?.(30 + Math.round((weakPageNumbers.indexOf(pageNumber) + 1) / weakPageNumbers.length * 70));
    }
    return cleanExtractedText(extractedPages.join('\n\f\n')) || null;
  } finally {
    await worker.terminate();
  }
}
