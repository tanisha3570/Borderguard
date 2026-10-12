// server/services/ocrEngine.js
// Server-side OCR engine using Tesseract.js in Node.js runtime

const { createWorker } = require('tesseract.js');
const { extractDocumentData } = require('./mrzParser');

let workerInstance = null;
let workerInitPromise = null;

async function getWorker() {
  if (workerInstance) return workerInstance;
  if (!workerInitPromise) {
    workerInitPromise = (async () => {
      try {
        const worker = await createWorker('eng');
        workerInstance = worker;
        return worker;
      } catch (err) {
        workerInitPromise = null;
        console.error('Failed to initialize server OCR worker:', err);
        throw err;
      }
    })();
  }
  return workerInitPromise;
}

/**
 * Perform server-side OCR on an image (buffer, base64 string, or filepath)
 * and extract structured document fields.
 *
 * @param {Buffer|string} imageInput - Buffer or data URL or filepath
 * @returns {Promise<{ rawText: string, confidence: number, parsed: object, processingTimeMs: number }>}
 */
async function processDocumentImage(imageInput) {
  const startTime = Date.now();
  if (!imageInput) {
    throw new Error('No image data provided for OCR processing');
  }

  // Handle base64 / data URL or file buffer
  let imageSource = imageInput;
  if (typeof imageInput === 'string' && imageInput.startsWith('data:image/')) {
    const base64Data = imageInput.replace(/^data:image\/\w+;base64,/, '');
    imageSource = Buffer.from(base64Data, 'base64');
  }

  const worker = await getWorker();

  // Primary OCR pass (PSM 3)
  let rawText = '';
  let confidence = 85;
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '3' });
    const result = await worker.recognize(imageSource);
    rawText = (result.data && result.data.text) ? result.data.text : '';
    if (result.data && typeof result.data.confidence === 'number') {
      confidence = result.data.confidence;
    }
  } catch (err) {
    console.warn('Server PSM 3 OCR pass error, retrying standard recognition:', err);
    const result = await worker.recognize(imageSource);
    rawText = (result.data && result.data.text) ? result.data.text : '';
  }

  // Fallback block pass if sparse
  if (!rawText || rawText.split('\n').filter(Boolean).length < 3) {
    try {
      await worker.setParameters({ tessedit_pageseg_mode: '6' });
      const blockResult = await worker.recognize(imageSource);
      const blockText = (blockResult.data && blockResult.data.text) ? blockResult.data.text : '';
      if (blockText && blockText.length > rawText.length) {
        rawText = blockText;
        if (blockResult.data?.confidence) confidence = blockResult.data.confidence;
      }
    } catch (err) {
      console.warn('Server block pass fallback error:', err);
    }
  }

  // Structured entity & MRZ parsing
  const parsed = extractDocumentData(rawText);

  const processingTimeMs = Date.now() - startTime;

  return {
    rawText,
    confidence: Math.round(confidence),
    parsed,
    processingTimeMs,
  };
}

module.exports = {
  getWorker,
  processDocumentImage,
};
