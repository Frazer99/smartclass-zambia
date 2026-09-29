'use client';

import { extractPdfTextLocally } from '@/lib/pdf-text-extraction';

type BrowserTesseract = {
  createWorker: (language: string, oem: number, options: {
    workerPath: string;
    corePath: string;
    langPath: string;
  }) => Promise<{ recognize: (image: HTMLImageElement) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> }>;
};

async function loadTesseract(): Promise<BrowserTesseract> {
  const windowWithTesseract = window as Window & { Tesseract?: BrowserTesseract };
  if (windowWithTesseract.Tesseract) return windowWithTesseract.Tesseract;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the image reading engine.'));
    document.head.appendChild(script);
  });
  if (!windowWithTesseract.Tesseract) throw new Error('The image reading engine did not initialize.');
  return windowWithTesseract.Tesseract;
}

export async function extractAnswerText(file: File, onProgress?: (value: number) => void): Promise<string> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const text = await extractPdfTextLocally(file, onProgress);
    if (text) return text;
    throw new Error('No readable text was found in this PDF. Please upload a clearer scan.');
  }

  if (file.type.startsWith('image/')) {
    onProgress?.(10);
    const tesseract = await loadTesseract();
    const worker = await tesseract.createWorker('eng', 1, {
      workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm.js',
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    });
    try {
      const image = new Image();
      image.src = URL.createObjectURL(file);
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Could not read this image.')); });
      const result = await worker.recognize(image);
      URL.revokeObjectURL(image.src);
      onProgress?.(100);
      return result.data.text.trim();
    } finally {
      await worker.terminate();
    }
  }

  if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) return file.text();
  throw new Error('Upload a PDF, image, or plain text answer sheet.');
}