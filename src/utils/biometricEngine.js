// src/utils/biometricEngine.js
// 1:1 Biometric Facial Vector Descriptor Matcher using face-api.js ResNet-34 Architecture

import * as faceapi from 'face-api.js';

let modelsLoadedPromise = null;

/**
 * Ensure face-api neural models are loaded and cached.
 */
export async function loadBiometricModels() {
  if (modelsLoadedPromise) return modelsLoadedPromise;

  modelsLoadedPromise = (async () => {
    try {
      // Primary model directory paths
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('/models/face_detection'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models/facial_mapping'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models/descriptor_extractor'),
      ]);
      return true;
    } catch (err) {
      console.warn('Fallback loading face-api models from /models root:', err);
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);
        return true;
      } catch (fallbackErr) {
        console.error('Failed to load biometric models:', fallbackErr);
        modelsLoadedPromise = null;
        throw fallbackErr;
      }
    }
  })();

  return modelsLoadedPromise;
}

/**
 * Universal source converter that scales down large images to standard resolution
 * for optimal neural network tensor performance and accurate face localization.
 */
async function toCanonicalImageElement(source) {
  if (source instanceof HTMLCanvasElement || source instanceof HTMLVideoElement) {
    return source;
  }

  if (source instanceof HTMLImageElement) {
    if (source.complete && source.naturalWidth > 0) {
      return source;
    }
    await new Promise((resolve, reject) => {
      source.onload = resolve;
      source.onerror = reject;
    });
    return source;
  }

  if (typeof source === 'string') {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const maxDim = 1280;
        if (img.width > maxDim || img.height > maxDim) {
          const scale = maxDim / Math.max(img.width, img.height);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas);
        } else {
          resolve(img);
        }
      };
      img.onerror = () => {
        // Fallback to fetchImage
        faceapi.fetchImage(source).then(resolve).catch(reject);
      };
      img.src = source;
    });
  }

  return source;
}

/**
 * Extract 128-d descriptor vector for a single detected face.
 * Uses multi-tier confidence scanning and area sorting to reliably isolate primary faces.
 */
export async function extractFaceDescriptor(imageSource) {
  await loadBiometricModels();
  const input = await toCanonicalImageElement(imageSource);

  // Tier 1: SSD MobileNet V1 with standard 0.30 confidence
  let detections = await faceapi
    .detectAllFaces(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.30 }))
    .withFaceLandmarks()
    .withFaceDescriptors();

  // Tier 2: If difficult lighting/contrast, retry with 0.15 confidence
  if (!detections || detections.length === 0) {
    detections = await faceapi
      .detectAllFaces(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.15 }))
      .withFaceLandmarks()
      .withFaceDescriptors();
  }

  // Tier 3: Single face fallback
  if (!detections || detections.length === 0) {
    const single = await faceapi
      .detectSingleFace(input)
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (single) return single;
    return null;
  }

  // If multiple face candidates detected, pick the largest area bounding box
  if (detections.length === 1) return detections[0];

  let largest = detections[0];
  let maxArea = largest.detection.box.width * largest.detection.box.height;
  for (let i = 1; i < detections.length; i++) {
    const area = detections[i].detection.box.width * detections[i].detection.box.height;
    if (area > maxArea) {
      maxArea = area;
      largest = detections[i];
    }
  }

  return largest;
}

/**
 * STRICT 1:1 Facial Biometric Comparison
 * 
 * Computes 128-dimensional Euclidean distance between reference credential photo
 * and live traveler portrait.
 *
 * @param {string|HTMLImageElement|HTMLCanvasElement|HTMLVideoElement} docImageSrc
 * @param {string|HTMLImageElement|HTMLCanvasElement|HTMLVideoElement} faceImageSrc
 * @returns {Promise<{success: boolean, score: number, distance: number|null, isMatch: boolean, reason?: string, verdict: string}>}
 */
export async function compareFaces(docImageSrc, faceImageSrc) {
  if (!docImageSrc || !faceImageSrc) {
    return {
      success: false,
      score: 0,
      distance: null,
      isMatch: false,
      reason: 'Both document photo and traveler portrait must be provided.',
      verdict: 'INSUFFICIENT_INPUT',
    };
  }

  try {
    await loadBiometricModels();

    const [docDetection, faceDetection] = await Promise.all([
      extractFaceDescriptor(docImageSrc),
      extractFaceDescriptor(faceImageSrc),
    ]);

    if (!docDetection) {
      return {
        success: false,
        score: 0,
        distance: null,
        isMatch: false,
        reason: 'No clear facial portrait detected in the credential document.',
        verdict: 'NO_DOC_FACE',
      };
    }

    if (!faceDetection) {
      return {
        success: false,
        score: 0,
        distance: null,
        isMatch: false,
        reason: 'No face detected in the traveler photo. Please ensure face is centered and clearly visible.',
        verdict: 'NO_TRAVELER_FACE',
      };
    }

    const distance = faceapi.euclideanDistance(docDetection.descriptor, faceDetection.descriptor);

    // MATCH THRESHOLD: distance <= 0.58 indicates genuine match under real-world camera lighting & angles
    const MATCH_THRESHOLD = 0.58;
    const isMatch = distance <= MATCH_THRESHOLD;

    let score = 0;
    if (isMatch) {
      // Scale genuine match score smoothly between 85% and 99%
      score = Math.round(99 - (distance / MATCH_THRESHOLD) * 14);
      score = Math.max(85, Math.min(99, score));
    } else {
      // Strict 0% for biometric mismatches / different people
      score = 0;
    }

    return {
      success: true,
      score,
      distance: Number(distance.toFixed(3)),
      isMatch,
      docBox: docDetection.detection.box,
      liveBox: faceDetection.detection.box,
      verdict: isMatch ? '1:1 MATCH VERIFIED' : 'BIOMETRIC MISMATCH (FAIL)',
    };
  } catch (err) {
    console.error('Biometric comparison failure:', err);
    return {
      success: false,
      score: 0,
      distance: null,
      isMatch: false,
      reason: err.message || 'Error processing facial descriptors.',
      verdict: 'ERROR',
    };
  }
}
