import { FileImage, Link2, Loader2, Plus, UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';
import { api, toApiError } from '../../lib/api';
import { toast } from '../../stores/toastStore';

export interface UploadedImageResult {
  url: string;
  alt: string;
  credit: string;
  license: string;
  sourceUrl: string;
}

interface ImageUploaderProps {
  onImagesAdded: (images: UploadedImageResult[]) => void;
  destinationName?: string;
  disabled?: boolean;
}

export function ImageUploader({ onImagesAdded, destinationName, disabled }: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function uploadFiles(files: FileList | File[]) {
    const validFiles = Array.from(files).filter((file) => {
      const isImg = file.type.startsWith('image/');
      if (!isImg) {
        toast.info(`Tệp "${file.name}" không phải là ảnh hợp lệ.`);
      }
      const isUnder10MB = file.size <= 10 * 1024 * 1024;
      if (!isUnder10MB) {
        toast.info(`Tệp "${file.name}" vượt quá dung lượng tối đa 10MB.`);
      }
      return isImg && isUnder10MB;
    });

    if (validFiles.length === 0) return;

    setIsUploading(true);
    const uploadedResults: UploadedImageResult[] = [];

    try {
      if (validFiles.length === 1) {
        const file = validFiles[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);

        const res = await api.post<{
          success: boolean;
          url: string;
          filename: string;
          originalName: string;
        }>('/admin/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        uploadedResults.push({
          url: res.data.url,
          alt: destinationName ? `${destinationName} - Ảnh chụp thực tế` : file.name.replace(/\.[^/.]+$/, ''),
          credit: 'Bộ sưu tập ảnh thực tế Ban Quản Lý',
          license: 'Bản quyền đơn vị sở hữu',
          sourceUrl: '',
        });
      } else {
        const formData = new FormData();
        validFiles.forEach((file) => formData.append('files', file));

        const res = await api.post<{
          success: boolean;
          items: Array<{ url: string; filename: string; originalName: string }>;
        }>('/admin/upload/multiple', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        res.data.items.forEach((item, idx) => {
          uploadedResults.push({
            url: item.url,
            alt: destinationName ? `${destinationName} - Ảnh ${idx + 1}` : item.originalName.replace(/\.[^/.]+$/, ''),
            credit: 'Bộ sưu tập ảnh thực tế Ban Quản Lý',
            license: 'Bản quyền đơn vị sở hữu',
            sourceUrl: '',
          });
        });
      }

      onImagesAdded(uploadedResults);
      toast.success(`Đã tải lên thành công ${uploadedResults.length} hình ảnh vào hệ thống!`);
    } catch (err) {
      const apiErr = toApiError(err);
      toast.error('Lỗi tải ảnh lên', apiErr.message || 'Không thể tải ảnh lên máy chủ');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleAddByUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('/') && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      toast.info('URL ảnh phải bắt đầu bằng http://, https:// hoặc đường dẫn /');
      return;
    }

    onImagesAdded([
      {
        url: trimmed,
        alt: destinationName ? `${destinationName} - Hình ảnh` : 'Hình ảnh điểm du lịch',
        credit: 'Ảnh tư liệu',
        license: '',
        sourceUrl: trimmed.startsWith('http') ? trimmed : '',
      },
    ]);

    setUrlInput('');
    toast.success('Đã thêm liên kết ảnh thành công');
  }

  return (
    <div className="rounded-card border border-sand-300 bg-sand-50/60 p-4">
      {/* Mode toggle */}
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-sand-200 pb-2.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-semibold transition ${
              mode === 'upload'
                ? 'bg-leaf-600 text-white shadow-sm'
                : 'text-river-600 hover:bg-sand-200/70 hover:text-river-900'
            }`}
          >
            <UploadCloud className="size-3.5" />
            Tải ảnh từ máy (Khuyên dùng)
          </button>
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-semibold transition ${
              mode === 'url'
                ? 'bg-leaf-600 text-white shadow-sm'
                : 'text-river-600 hover:bg-sand-200/70 hover:text-river-900'
            }`}
          >
            <Link2 className="size-3.5" />
            Nhập đường dẫn URL
          </button>
        </div>

        <span className="text-xs text-river-500">Hỗ trợ JPG, PNG, WebP (Tối đa 10MB/ảnh)</span>
      </div>

      {mode === 'upload' ? (
        <div>
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            className="hidden"
            disabled={disabled || isUploading}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                void uploadFiles(e.target.files);
              }
            }}
          />

          {/* Drag & Drop Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                void uploadFiles(e.dataTransfer.files);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`group flex cursor-pointer flex-col items-center justify-center rounded-control border-2 border-dashed p-6 text-center transition ${
              isDragOver
                ? 'border-leaf-600 bg-leaf-50'
                : 'border-sand-300 bg-white hover:border-leaf-500 hover:bg-leaf-50/30'
            } ${disabled || isUploading ? 'pointer-events-none opacity-60' : ''}`}
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="size-8 animate-spin text-leaf-600" />
                <p className="text-sm font-medium text-river-800">Đang lưu trữ hình ảnh lên hệ thống...</p>
                <p className="text-xs text-river-500">Vui lòng đợi trong giây lát</p>
              </div>
            ) : (
              <>
                <div className="mb-2.5 inline-flex size-11 items-center justify-center rounded-full bg-leaf-100 text-leaf-700 transition group-hover:scale-110">
                  <UploadCloud className="size-6" />
                </div>
                <h4 className="text-sm font-semibold text-river-900">
                  Bấm vào đây để chọn ảnh từ máy hoặc kéo thả ảnh vào đây
                </h4>
                <p className="mt-1 text-xs text-river-600">
                  Ảnh sẽ được lưu trực tiếp vào bộ nhớ đám mây của điểm đến, không lo bị lộ nguồn ngoài.
                </p>
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-control bg-leaf-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-cta hover:bg-leaf-700"
                >
                  <FileImage className="size-3.5" />
                  Chọn ảnh từ máy tính / điện thoại
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Dán đường dẫn ảnh: /images/... hoặc https://..."
            className="flex-1 rounded-control border border-sand-300 bg-white px-3 py-2 text-sm text-river-900 placeholder:text-river-400 focus:border-leaf-600 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddByUrl();
              }
            }}
          />
          <button
            type="button"
            onClick={handleAddByUrl}
            className="inline-flex items-center gap-1.5 rounded-control bg-river-900 px-4 py-2 text-xs font-semibold text-white hover:bg-river-800"
          >
            <Plus className="size-3.5" />
            Thêm ảnh
          </button>
        </div>
      )}
    </div>
  );
}
