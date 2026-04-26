'use client';

import { ExternalLink, FileText, ImageIcon } from 'lucide-react';
import { truncate } from '@/lib/format';
import { cn } from '@/lib/utils';

interface FilePreviewGalleryProps {
  title: string;
  files: string[];
  emptyMessage: string;
  className?: string;
}

function isImageFile(url: string) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
}

function getFileName(url: string) {
  try {
    const pathname = new URL(url).pathname;
    return decodeURIComponent(pathname.split('/').pop() || 'File');
  } catch {
    return decodeURIComponent(url.split('/').pop() || 'File');
  }
}

export function FilePreviewGallery({
  title,
  files,
  emptyMessage,
  className,
}: FilePreviewGalleryProps) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-slate-100 bg-slate-50/70 p-5',
        className,
      )}
    >
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-4">
        {files.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {files.map((fileUrl, index) =>
              isImageFile(fileUrl) ? (
                <a
                  key={fileUrl}
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden rounded-3xl border border-slate-200 bg-white transition hover:border-slate-300"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                    {/* User-uploaded files can come from mixed local/provider URLs, so a plain img is safer here than Next image optimization. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fileUrl}
                      alt={`${title} ${index + 1}`}
                      className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        Image {index + 1}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {truncate(getFileName(fileUrl), 30)}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D1B3E]">
                      View
                      <ExternalLink size={14} />
                    </span>
                  </div>
                </a>
              ) : (
                <a
                  key={fileUrl}
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-4 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      File {index + 1}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {truncate(getFileName(fileUrl), 34)}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D1B3E]">
                    Open
                    <ExternalLink size={14} />
                  </span>
                </a>
              ),
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
            <div className="flex items-center gap-2 text-slate-400">
              <ImageIcon size={16} />
              <span>{emptyMessage}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
