import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getApiBaseUrl } from '../utils/apiBase';

const API_BASE_URL = getApiBaseUrl();
const MAX_SCAN_IMAGE_BYTES = 8 * 1024 * 1024;

export default function ScanUploadModal({ onClose }) {
  const { t } = useLanguage();
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, submitting]);

  const openPicker = () => {
    fileInputRef.current?.click();
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

      window.dispatchEvent(new CustomEvent('mangoguard-cloud-scan-complete', { detail: payload }));
      window.dispatchEvent(new CustomEvent('mangoguard-live-update', { detail: { source: 'web_app' } }));
      onClose();
    } catch (submitError) {
      setError(submitError.message || t('quickScan', 'scanFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => !submitting && onClose()}>
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
          <div className="scan-modal-note">
            <i className="fa-solid fa-circle-info"></i>
            <span>{t('quickScan', 'storageHint')}</span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <button type="button" className="scan-upload-dropzone" onClick={openPicker}>
            {previewUrl ? (
              <>
                <img src={previewUrl} alt={t('quickScan', 'previewAlt')} className="scan-upload-preview" />
                <span className="scan-upload-file">{selectedFile?.name}</span>
              </>
            ) : (
              <>
                <span className="scan-upload-icon">
                  <i className="fa-solid fa-camera"></i>
                </span>
                <span className="scan-upload-title">{t('quickScan', 'pickImage')}</span>
                <span className="scan-upload-hint">{t('quickScan', 'pickImageHint')}</span>
              </>
            )}
          </button>

          {error && <div className="profile-error">{error}</div>}

          <div className="scan-modal-actions">
            <button type="button" className="secondary-btn scan-secondary-btn" onClick={openPicker} disabled={submitting}>
              {selectedFile ? t('quickScan', 'changeImage') : t('quickScan', 'pickImage')}
            </button>
            <button type="button" className="primary-btn scan-primary-btn" onClick={handleSubmit} disabled={!selectedFile || submitting}>
              {submitting ? t('common', 'loading') : t('quickScan', 'runAction')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
