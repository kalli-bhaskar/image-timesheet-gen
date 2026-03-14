import React, { useRef, useState } from 'react';
import { Camera, X, Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { localClient } from '@/api/localClient';

export default function CameraCapture({ onCapture, onCancel, label, captureMode = 'camera' }) {
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);

  const handleCapture = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(f);
  };

  const handleConfirm = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await localClient.integrations.Core.UploadFile({ file });
      const timestamp = new Date().toISOString();
      await onCapture({ photoUrl: file_url, timestamp, file, fileName: file.name });
    } finally {
      setUploading(false);
    }
  };

  const handleRetake = () => {
    setPreview(null);
    setFile(null);
    fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4">
      <div className="text-white text-lg font-semibold mb-6">{label}</div>

      {!preview ? (
        <div className="flex flex-col items-center gap-6">
          <div className="w-48 h-48 rounded-full border-4 border-dashed border-blue-400/50 flex items-center justify-center">
            <Camera className="w-16 h-16 text-blue-400" />
          </div>
          <Button
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg rounded-2xl"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="w-5 h-5 mr-2" />
            {captureMode === 'camera' ? 'Take Photo' : 'Choose Photo'}
          </Button>
          <Button
            variant="ghost"
            className="text-slate-400 hover:text-white"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture={captureMode === 'camera' ? 'environment' : undefined}
            onChange={handleCapture}
            className="hidden"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 w-full max-w-sm">
          <div className="w-full aspect-square rounded-2xl overflow-hidden bg-slate-800">
            <img src={preview} alt="Captured" className="w-full h-full object-cover" />
          </div>
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              className="flex-1 py-5 border-slate-600 text-slate-300 hover:bg-slate-800"
              onClick={handleRetake}
              disabled={uploading}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Retake
            </Button>
            <Button
              className="flex-1 py-5 bg-green-600 hover:bg-green-700 text-white"
              onClick={handleConfirm}
              disabled={uploading}
            >
              {uploading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirm
                </>
              )}
            </Button>
          </div>
          <Button
            variant="ghost"
            className="text-slate-400 hover:text-white"
            onClick={onCancel}
            disabled={uploading}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}