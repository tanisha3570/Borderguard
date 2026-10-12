let workerPromise = null;
let progressHandler = null;

function tessBaseUrl() {
  if (typeof window === 'undefined') return '/tesseract';
  return `${window.location.origin}/tesseract`;
}

function localWorkerOptions() {
  const base = tessBaseUrl();
  return {
    workerPath: `${base}/worker.min.js`,
    corePath: `${base}`,
    langPath: `${base}`,
    gzip: true,
    workerBlobURL: true,
    logger: (m) => {
      if (typeof progressHandler === 'function') progressHandler(m);
    },
    errorHandler: (err) => {
      console.error('Tesseract worker error:', err);
    },
  };
}

async function createOcrWorker(options) {
  const tesseractMod = await import('tesseract.js');
  const createWorker = tesseractMod.createWorker || tesseractMod.default?.createWorker;
  return createWorker('eng', 1, options);
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createOcrWorker(localWorkerOptions()).catch(async (localErr) => {
      console.warn('Local Tesseract assets failed, falling back to default CDN paths:', localErr);
      workerPromise = null;
      const fallback = await createOcrWorker({
        logger: (m) => {
          if (typeof progressHandler === 'function') progressHandler(m);
        },
        errorHandler: (err) => console.error('Tesseract worker error:', err),
      });
      workerPromise = Promise.resolve(fallback);
      return fallback;
    });
  }
  return workerPromise;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load document image for OCR'));
    img.src = src;
  });
}

function canvasToDataUrl(canvas) {
  try {
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('canvas toDataURL failed:', err);
    return null;
  }
}

/**
 * Upscale low-res scans, convert to grayscale, stretch contrast, and
 * apply mild sharpening so Tesseract captures fine print and MRZ characters.
 */
export async function preprocessImageForOcr(imgSrc) {
  try {
    const img = await loadImage(imgSrc);
    const minDimension = 1600;
    let scale = 1;
    if (Math.max(img.width, img.height) < minDimension) {
      scale = Math.min(3.5, minDimension / Math.max(img.width, img.height));
    }

    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;

    // Grayscale + Contrast calculation
    let min = 255;
    let max = 0;
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = gray;
      if (gray < min) min = gray;
      if (gray > max) max = gray;
    }

    // Histogram stretch
    const range = Math.max(1, max - min);
    for (let i = 0; i < d.length; i += 4) {
      const stretched = ((d[i] - min) * 255) / range;
      d[i] = d[i + 1] = d[i + 2] = stretched;
    }

    ctx.putImageData(imgData, 0, 0);
    return canvasToDataUrl(canvas) || imgSrc;
  } catch (err) {
    console.warn('OCR preprocess failed, using original image:', err);
    return imgSrc;
  }
}

async function cropBottomBand(imgSrc, fraction = 0.42) {
  try {
    const img = await loadImage(imgSrc);
    const bandH = Math.max(80, Math.floor(img.height * fraction));
    const y = Math.max(0, img.height - bandH);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = bandH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, y, img.width, bandH, 0, 0, img.width, bandH);
    return canvasToDataUrl(canvas);
  } catch (err) {
    return null;
  }
}

async function recognizeWithParams(worker, image, params) {
  if (params && Object.keys(params).length > 0) {
    await worker.setParameters(params);
  }
  const { data } = await worker.recognize(image);
  return (data && data.text) || '';
}

/**
 * Run multi-pass Tesseract OCR on a document image and return concatenated raw text.
 * Pass 1: Full-page layout recognition (PSM 3)
 * Pass 2: MRZ band pass (PSM 6 with character whitelist)
 * Pass 3: Fallback block pass (PSM 6) if full-page pass was sparse
 */
export async function extractDocumentText(imgSrc, onProgress) {
  if (!imgSrc) throw new Error('No document image provided');

  progressHandler = (m) => {
    if (!onProgress) return;
    if (m.status === 'recognizing text') {
      onProgress(Math.max(0, Math.min(1, m.progress || 0)), m.status);
    } else if (
      m.status === 'loading tesseract core' ||
      m.status === 'initializing tesseract' ||
      m.status === 'loading language traineddata'
    ) {
      onProgress(0.05, m.status);
    }
  };

  const prepped = await preprocessImageForOcr(imgSrc);
  const worker = await getWorker();
  await worker.reinitialize('eng');

  let fullText = '';
  try {
    fullText = await recognizeWithParams(worker, prepped, {
      tessedit_pageseg_mode: '3',
    });
    if (onProgress) onProgress(0.55, 'recognizing text');
  } catch (err) {
    console.warn('Preprocessed OCR pass failed, retrying original image:', err);
    fullText = await recognizeWithParams(worker, imgSrc, {
      tessedit_pageseg_mode: '3',
    });
  }

  // If text is short or sparse, try a uniform single block pass (PSM 6)
  if (!fullText || fullText.split('\n').filter(Boolean).length < 4) {
    try {
      const blockPass = await recognizeWithParams(worker, prepped, {
        tessedit_pageseg_mode: '6',
      });
      if (blockPass && blockPass.length > fullText.length) {
        fullText = blockPass;
      }
    } catch (err) {
      console.warn('Block pass fallback notice:', err);
    }
  }

  // Targeted MRZ pass on bottom 42% of document
  let mrzText = '';
  const band = await cropBottomBand(prepped, 0.42);
  if (band) {
    try {
      if (onProgress) onProgress(0.8, 'recognizing text');
      mrzText = await recognizeWithParams(worker, band, {
        tessedit_pageseg_mode: '6',
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
      });
    } catch (err) {
      console.warn('MRZ-band OCR pass failed:', err);
    }
  }

  await worker.reinitialize('eng');

  if (onProgress) onProgress(1, 'done');

  // Merge and deduplicate lines cleanly
  const allLines = `${fullText}\n${mrzText}`.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const uniqueLines = [];
  const seen = new Set();
  for (const l of allLines) {
    const norm = l.toUpperCase().replace(/\s+/g, '');
    if (!seen.has(norm)) {
      seen.add(norm);
      uniqueLines.push(l);
    }
  }

  const merged = uniqueLines.join('\n');
  if (!merged) {
    throw new Error('No readable text detected in document image.');
  }
  return merged;
}
