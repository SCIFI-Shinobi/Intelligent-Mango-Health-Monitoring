import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useLanguage } from '../context/LanguageContext';
import { getApiBaseUrl } from '../utils/apiBase';

const API_BASE_URL = getApiBaseUrl();
const MAX_SCAN_IMAGE_BYTES = 8 * 1024 * 1024;

export default function ScanUploadModal({ onClose, currentSensorData }) {
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
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [capturedFromCamera, setCapturedFromCamera] = useState(false);
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
      setIsCameraReady(false);
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
    if (!videoRef.current || !isCameraReady) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setSelectedFile(file);
      setCapturedFromCamera(true);
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
    setCapturedFromCamera(false);
    setError('');
  };

  const handleSubmit = async () => {
    if (!selectedFile || submitting) return;

    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('image', selectedFile);
    if (currentSensorData?.temperature !== undefined) {
      formData.append('temperature', currentSensorData.temperature);
    }
    if (currentSensorData?.humidity !== undefined) {
      formData.append('humidity', currentSensorData.humidity);
    }

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
            const getTranslatedRecommendationDesc = (rec) => {
              if (!rec) return 'Keep monitoring regularly. Maintain standard irrigation and sanitation practices.';
              if (typeof rec === 'string') return rec;
              return lang === 'am' ? (rec.description_am || rec.description) : rec.description;
            };
            return (
              <div className="scan-result-container" style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', borderRadius: '50%', background: scanResult.disease_type === 'Healthy' ? 'rgba(63, 185, 80, 0.1)' : 'rgba(210, 153, 34, 0.1)', color: scanResult.disease_type === 'Healthy' ? '#3fb950' : '#d29922', fontSize: '36px', marginBottom: '20px' }}>
                  <i className={scanResult.disease_type === 'Healthy' ? "fa-solid fa-leaf" : "fa-solid fa-triangle-exclamation"}></i>
                </div>
                
                <h3 className="scan-result-title" style={{ marginBottom: '8px', fontSize: '24px', fontWeight: '600', color: '#e6edf3', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  {getTranslatedDisease(scanResult.disease_type)}
                  {scanResult.confidence_score && (
                    <span style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '20px', background: 'rgba(47, 129, 247, 0.15)', color: '#58a6ff', fontWeight: '700', border: '1px solid rgba(47, 129, 247, 0.3)' }}>
                      {(scanResult.confidence_score * 100).toFixed(1)}% Confident
                    </span>
                  )}
                </h3>
                
                {scanResult.disease_type !== 'Healthy' && (
                  <div style={{ display: 'inline-block', padding: '4px 12px', background: 'rgba(210, 153, 34, 0.15)', color: '#d29922', borderRadius: '20px', fontSize: '13px', fontWeight: '600', marginBottom: '24px' }}>
                    <i className="fa-solid fa-microscope" style={{ marginRight: '6px' }}></i>
                    {t('analysis', 'scanCompletedStatus') || 'AI Diagnostic Complete'}
                  </div>
                )}
                {scanResult.disease_type === 'Healthy' && (
                  <div style={{ display: 'inline-block', padding: '4px 12px', background: 'rgba(63, 185, 80, 0.15)', color: '#3fb950', borderRadius: '20px', fontSize: '13px', fontWeight: '600', marginBottom: '24px' }}>
                    <i className="fa-solid fa-check-double" style={{ marginRight: '6px' }}></i>
                    {t('analysis', 'healthyStatus') || 'Optimal Health Verified'}
                  </div>
                )}

                <div style={{ background: '#161b22', padding: '24px', borderRadius: '16px', border: '1px solid #30363d', marginBottom: '28px', textAlign: 'left', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: scanResult.disease_type === 'Healthy' ? '#3fb950' : '#d29922' }}></div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-clipboard-list" style={{ color: scanResult.disease_type === 'Healthy' ? '#3fb950' : '#d29922' }}></i>
                    {t('rec', 'actionPlan') || 'Agronomist Action Plan'}
                  </h4>
                  <p className="scan-result-recommendation" style={{ margin: 0, fontSize: '15px', lineHeight: '1.6', color: '#c9d1d9' }}>
                    {getTranslatedRecommendationDesc(scanResult.recommendation)}
                  </p>
                </div>
                
                <button type="button" className="primary-btn" onClick={onClose} style={{ width: '100%', padding: '12px', fontSize: '15px', fontWeight: '600' }}>
                  {t('common', 'close') || 'Acknowledge & Close'}
                </button>
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
                <div className="camera-capture" style={{ position: 'relative', width: '100%', minHeight: '350px', backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted
                    onLoadedMetadata={() => setIsCameraReady(true)}
                    className="camera-preview" 
                    style={{ flex: 1, width: '100%', objectFit: 'cover', minHeight: '280px' }} 
                  />
                  <div className="camera-actions" style={{ position: 'absolute', bottom: '16px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '16px', zIndex: 10 }}>
                    <button 
                      type="button" 
                      onClick={capturePhoto} 
                      disabled={!isCameraReady}
                      style={{ 
                        padding: '12px 24px', 
                        borderRadius: '30px', 
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)', 
                        background: isCameraReady ? '#2f81f7' : '#4a4f55', 
                        color: 'white', 
                        border: 'none', 
                        fontWeight: '600', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        cursor: isCameraReady ? 'pointer' : 'not-allowed', 
                        fontSize: '15px',
                        opacity: isCameraReady ? 1 : 0.7
                      }}
                    >
                      <i className="fa-solid fa-camera"></i> Capture
                    </button>
                    <button type="button" onClick={stopCamera} style={{ padding: '12px 24px', borderRadius: '30px', background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '15px' }}>
                      <i className="fa-solid fa-xmark"></i> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="scan-upload-dropzone" onClick={!submitting ? openCamera : undefined}>
                  {previewUrl ? (
                    <div className={`scan-preview-container ${submitting ? 'is-scanning' : ''}`} style={{ position: 'relative' }}>
                      <img src={previewUrl} alt={t('quickScan', 'previewAlt')} className="scan-upload-preview" />
                      {capturedFromCamera && !submitting && (
                        <button 
                          type="button" 
                          className="retake-btn" 
                          onClick={openCamera}
                          style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            background: 'rgba(0,0,0,0.6)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.3)',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backdropFilter: 'blur(4px)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            zIndex: 10
                          }}
                        >
                          <i className="fa-solid fa-rotate-left"></i> {t('quickScan', 'retake') || 'Retake'}
                        </button>
                      )}
                      {submitting && (
                        <div className="scanner-overlay">
                          <div className="scanner-dots"></div>
                        </div>
                      )}
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
