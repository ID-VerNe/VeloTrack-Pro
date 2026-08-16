import React, { useCallback, useState } from 'react';
import { UploadCloud, CheckCircle, AlertCircle, RefreshCw, Layers } from 'lucide-react';

export interface BatchProgress {
  total: number;
  current: number;
  currentFileName: string;
  successCount: number;
  failedCount: number;
}

interface FileUploadProps {
  onFilesSelect: (files: File[]) => void;
  status: 'idle' | 'parsing' | 'uploading' | 'success' | 'error';
  batchProgress?: BatchProgress;
  errorMessage?: string;
}

export function FileUpload({ onFilesSelect, status, batchProgress, errorMessage }: FileUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(f => 
        f.name.toLowerCase().endsWith('.tcx') || f.name.toLowerCase().endsWith('.gpx')
      );
      if (files.length > 0) {
        setStagedFiles(files);
      }
    }
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setStagedFiles(files);
    }
  }, []);

  const handleTriggerUpload = () => {
    if (stagedFiles.length > 0) {
      onFilesSelect(stagedFiles);
    }
  };

  const progressPercent = batchProgress && batchProgress.total > 0
    ? Math.round((batchProgress.current / batchProgress.total) * 100)
    : 0;

  return (
    <div className="flex flex-col items-center w-full space-y-6">
      {/* Drag & Drop Area */}
      <div
        className={`relative flex flex-col items-center justify-center w-full h-[320px] border-2 border-dashed rounded-3xl transition-all duration-200 ${
          isDragActive
            ? 'border-blue-500 bg-blue-50/50 scale-[1.005]'
            : 'border-slate-300 bg-slate-50/60 hover:bg-slate-50'
        } ${status === 'success' ? 'border-emerald-400 bg-emerald-50/40' : ''} ${
          status === 'error' ? 'border-rose-400 bg-rose-50/40' : ''
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".tcx,.gpx"
          multiple
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          onChange={handleChange}
          disabled={status === 'parsing' || status === 'uploading'}
          aria-label="选取或拖入骑行数据文件"
        />

        <div className="flex flex-col items-center text-center space-y-4 p-6 pointer-events-none w-full max-w-md">
          {status === 'idle' && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-200/80 flex items-center justify-center text-slate-400">
                {stagedFiles.length > 1 ? (
                  <Layers className="w-8 h-8 text-blue-600 stroke-[1.8]" />
                ) : (
                  <UploadCloud className="w-8 h-8 text-slate-400 stroke-[1.8]" />
                )}
              </div>
              <div>
                <p className="text-lg sm:text-xl font-bold text-slate-800">
                  {stagedFiles.length > 0 
                    ? `已选取 ${stagedFiles.length} 个骑行运动文件`
                    : '拖入 TCX 或 GPX 骑行文件至此处'
                  }
                </p>
                <p className="text-xs text-slate-400 font-medium mt-1.5">
                  支持 Garmin、华为运动健康、Apple Watch 等标准格式文件批量拖入
                </p>
              </div>
            </>
          )}

          {(status === 'parsing' || status === 'uploading') && batchProgress && (
            <div className="w-full space-y-3">
              <RefreshCw className="w-10 h-10 text-blue-600 animate-spin stroke-[2] mx-auto" />
              <div>
                <p className="text-base font-bold text-blue-600">
                  正在处理批量同步 ({batchProgress.current} / {batchProgress.total})...
                </p>
                <p className="text-xs text-slate-500 font-medium truncate max-w-xs mx-auto mt-0.5">
                  {batchProgress.currentFileName}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden shadow-inner">
                <div 
                  className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-400 font-semibold tabular-nums">
                {progressPercent}% 完成（已成功导入 {batchProgress.successCount} 个活动）
              </div>
            </div>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 text-emerald-500 stroke-[2]" />
              <div>
                <p className="text-lg font-bold text-emerald-600">批量上传并脱敏成功！</p>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  已成功同步 {stagedFiles.length || '全部'} 次骑行数据至云端 D1 数据库
                </p>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <AlertCircle className="w-12 h-12 text-rose-500 stroke-[2]" />
              <div>
                <p className="text-lg font-bold text-rose-600">导入过程中遇到异常</p>
                <p className="text-xs text-rose-500 mt-1 max-w-sm">{errorMessage}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={handleTriggerUpload}
        disabled={stagedFiles.length === 0 || status === 'parsing' || status === 'uploading'}
        className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-500/25 transition-all transform active:scale-95 disabled:shadow-none cursor-pointer disabled:cursor-not-allowed flex items-center space-x-2"
      >
        {status === 'uploading' || status === 'parsing' ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>正在批量脱敏并同步...</span>
          </>
        ) : (
          <span>
            {stagedFiles.length > 1 ? `一键脱敏并同步 ${stagedFiles.length} 个活动` : '一键脱敏并同步到云端'}
          </span>
        )}
      </button>
    </div>
  );
}
