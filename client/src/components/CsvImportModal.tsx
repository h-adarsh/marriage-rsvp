import React, { useState, useRef } from 'react';
import { Modal } from './Modal';
import {
  importHouseholdCsvApi,
  CsvImportPreviewResponse,
  CsvImportCommitResponse,
} from '../api/households';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Download,
  Loader2,
} from 'lucide-react';

interface CsvImportModalProps {
  isOpen: boolean;
  weddingId: string;
  onClose: () => void;
  onImportComplete: () => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  weddingId,
  onClose,
  onImportComplete,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<CsvImportPreviewResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setSelectedFile(null);
    setPreviewData(null);
    setIsAnalyzing(false);
    setIsCommitting(false);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDownloadSample = () => {
    const csvContent =
      'Household Name,Primary Contact,Phone,Expected Party Size,Notes\n' +
      'Kapoor Family,Anil Kapoor,+919876543210,4,Close family\n' +
      'Sharma Household,Pooja Sharma,+919876543211,2,Groom side cousin\n' +
      'Verma Family,Sunita Verma,+919876543212,3,Vegetarian preference';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'wedding_guest_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('File exceeds the 2MB size limit.');
      return;
    }

    setSelectedFile(file);
    setPreviewData(null);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setErrorMsg(null);

    try {
      const response = await importHouseholdCsvApi(weddingId, selectedFile, true);
      setPreviewData(response as CsvImportPreviewResponse);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to analyze CSV';
      setErrorMsg(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCommit = async () => {
    if (!selectedFile) return;

    setIsCommitting(true);
    setErrorMsg(null);

    try {
      const response = (await importHouseholdCsvApi(
        weddingId,
        selectedFile,
        false
      )) as CsvImportCommitResponse;

      setSuccessMsg(
        `Successfully imported ${response.importedCount} households! (${response.duplicateCount} duplicates skipped)`
      );

      setTimeout(() => {
        onImportComplete();
        handleClose();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      setErrorMsg(msg);
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Guests from CSV"
      subtitle="Upload guest lists, detect duplicates, and preview records before importing"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Sample Template Download Bar */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Need the standard CSV layout?</span>
          </div>
          <button
            type="button"
            onClick={handleDownloadSample}
            className="font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Sample Template</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-emerald-800 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Step 1: File Dropzone */}
        {!previewData && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={handleFileChange}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-rose-400 hover:bg-rose-50/20 rounded-2xl p-8 text-center cursor-pointer transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                {selectedFile ? selectedFile.name : 'Click to select or drag a CSV file here'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {selectedFile
                  ? `${(selectedFile.size / 1024).toFixed(1)} KB • Click to choose a different file`
                  : 'Supports .csv up to 2MB (Columns: Household Name, Primary Contact, Phone, Expected Party Size)'}
              </p>
            </div>

            {selectedFile && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-2 disabled:opacity-60"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Analyzing File...</span>
                    </>
                  ) : (
                    <span>Analyze & Preview Rows</span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Analysis & Preview State */}
        {previewData && (
          <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Ready to Import</p>
                <p className="text-lg font-extrabold text-emerald-900 mt-0.5">{previewData.toImportCount}</p>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Duplicates Skipped</p>
                <p className="text-lg font-extrabold text-amber-900 mt-0.5">{previewData.duplicateCount}</p>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Invalid Rows</p>
                <p className="text-lg font-extrabold text-rose-900 mt-0.5">{previewData.invalidCount}</p>
              </div>
            </div>

            {/* Duplicates Alert Banner */}
            {previewData.duplicates.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>{previewData.duplicates.length} Duplicate(s) Detected:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800">
                  {previewData.duplicates.slice(0, 3).map((d, i) => (
                    <li key={i}>
                      Row {d.rowNumber}: <span className="font-semibold">{d.name}</span> ({d.phone}) — {d.reason}
                    </li>
                  ))}
                  {previewData.duplicates.length > 3 && (
                    <li>...and {previewData.duplicates.length - 3} more</li>
                  )}
                </ul>
              </div>
            )}

            {/* Preview Table */}
            <div>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Preview of Valid Households ({previewData.previewRows.length})
              </p>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-400">
                    <tr>
                      <th className="py-2 px-3">Household</th>
                      <th className="py-2 px-3">Contact</th>
                      <th className="py-2 px-3">Phone</th>
                      <th className="py-2 px-3 text-center">Guests</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {previewData.previewRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{row.name}</td>
                        <td className="py-2 px-3">{row.primaryContactName}</td>
                        <td className="py-2 px-3 text-slate-500">{row.phone}</td>
                        <td className="py-2 px-3 text-center font-bold text-slate-800">
                          {row.expectedPartySize}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPreviewData(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Choose Another File
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={isCommitting || previewData.toImportCount === 0}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isCommitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <span>Import {previewData.toImportCount} Households</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
