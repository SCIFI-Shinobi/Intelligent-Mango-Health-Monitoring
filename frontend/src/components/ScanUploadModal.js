import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useLanguage } from '../context/LanguageContext';
import { getApiBaseUrl } from '../utils/apiBase';

const API_BASE_URL = getApiBaseUrl();
const MAX_SCAN_IMAGE_BYTES = 8 * 1024 * 1024;

export default function ScanUploadModal({ onClose }) {
  const { t, lang } = useLanguage();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [usingCamera, setUsingCamera] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return undefined;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && !submitting) {
        stopCamera();
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, submitting]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const openPicker = () => {
    fileInputRef.current?.click();
  };

  const openCamera = () => {
    // Try opening the camera directly; fall back to file input where not available
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      startCamera();
    } else {
      cameraInputRef.current?.click();
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setUsingCamera(true);
    } catch (e) {
      console.error('Camera access failed, falling back to file input', e);
      cameraInputRef.current?.click();
    }
  };

  const stopCamera = () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    } catch (e) {
      console.error('Error stopping camera stream', e);
    }
    streamRef.current = null;
    setUsingCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setSelectedFile(file);
      setError('');
      stopCamera();
    }, 'image/jpeg', 0.9);
  };

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;

    if (!nextFile.type.startsWith('image/')) {
      setError(t('quickScan', 'invalidImageType'));
      event.target.value = '';
      return;
    }

    if (nextFile.size > MAX_SCAN_IMAGE_BYTES) {
      setError(t('quickScan', 'fileTooLarge'));
      event.target.value = '';
      return;
    }

    setSelectedFile(nextFile);
    setError('');
  };

  const handleSubmit = async () => {
    if (!selectedFile || submitting) return;

    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      setSubmitting(true);
      setError('');

      const response = await fetch(`${API_BASE_URL}/scan/cloud`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.detail || t('quickScan', 'scanFailed'));
      }

      setScanResult(payload);
    } catch (submitError) {
      setError(submitError.message || t('quickScan', 'scanFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="modal-overlay scan-modal-overlay" onClick={() => !submitting && onClose()}>
      <div className="scan-modal" onClick={(event) => event.stopPropagation()}>
        <div className="profile-modal-header">
          <div>
            <h2>{t('quickScan', 'title')}</h2>
            <p className="scan-modal-subtitle">{t('quickScan', 'subtitle')}</p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} disabled={submitting}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="profile-modal-body scan-modal-body">
          {scanResult ? (() => {
            const getTranslatedDisease = (disease) => {
              if (disease === 'Healthy') return t('disease', 'healthy') || 'Healthy';
              const key = disease.charAt(0).toLowerCase() + disease.slice(1).replace(' ', '');
              return t('disease', key) || disease;
            };
            const getTranslatedRecommendation = (rec) => {
              if (!rec) return 'Keep monitoring regularly.';
              if (typeof rec === 'string') return rec;
              return lang === 'am' ? (rec.title_am || rec.title) : rec.title;
            };
            return (
              <div className="scan-result-container">
                <h3 className="scan-result-title">{getTranslatedDisease(scanResult.disease_type)}</h3>
                <div className="scan-result-metrics">
                  <span className="scan-result-confidence">Confidence: {(scanResult.confidence_score * 100).toFixed(1)}%</span>
                  <span className={`scan-result-severity severity-${(scanResult.severity || 'low').toLowerCase()}`}>Severity: {scanResult.severity || 'Low'}</span>
                </div>
                <p className="scan-result-recommendation">{getTranslatedRecommendation(scanResult.recommendation)}</p>
                <button type="button" className="primary-btn" onClick={onClose}>Close</button>
              </div>
            );
          })() : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              {usingCamera ? (
                <div className="camera-capture">
                  <video ref={videoRef} autoPlay playsInline className="camera-preview" />
                  <div className="camera-actions">
                    <button type="button" className="secondary-btn" onClick={capturePhoto}>Capture</button>
                    <button type="button" className="secondary-btn" onClick={stopCamera}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="scan-upload-dropzone" onClick={!submitting ? openCamera : undefined}>
                  {previewUrl ? (
                    <div className={`scan-preview-container ${submitting ? 'is-scanning' : ''}`}>
                      <img src={previewUrl} alt={t('quickScan', 'previewAlt')} className="scan-upload-preview" />
                      {submitting && (
                        <div className="scanner-overlay">
                          <div className="scanner-dots"></div>
                        </div>
                      )}
                      <span className="scan-upload-file">{selectedFile?.name}</span>
                    </div>
                  ) : (
                    <>
                      <span className="scan-upload-icon">
                        <i className="fa-solid fa-camera"></i>
                      </span>
                      <span className="scan-upload-title">{t('quickScan', 'takePhoto') === 'takePhoto' ? 'Take a Photo' : t('quickScan', 'takePhoto')}</span>
                      <span className="scan-upload-hint">Tap to open camera</span>
                    </>
                  )}
                </button>
              )}

              {error && <div className="profile-error">{error}</div>}

              <div className="scan-modal-actions">
                <button type="button" className="secondary-btn scan-secondary-btn" onClick={openPicker} disabled={submitting}>
                  <i className="fa-solid fa-image"></i> {selectedFile ? t('quickScan', 'changeImage') : t('quickScan', 'pickImage') || 'Select Image'}
                </button>
                <button type="button" className="primary-btn scan-primary-btn" onClick={handleSubmit} disabled={!selectedFile || submitting}>
                  {submitting ? t('common', 'loading') : t('quickScan', 'runAction')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
