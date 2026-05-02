import apiClient from '@/lib/api-client';

export interface UploadedOrderFile {
  url: string;
  publicId: string;
  filename: string | null;
}

export async function uploadOrderFiles(files: File[]) {
  if (files.length === 0) {
    return [];
  }

  const formData = new FormData();

  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await apiClient.post<{
    data: {
      items: UploadedOrderFile[];
    };
  }>('/orders/uploads', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.data.items;
}

export async function cleanupOrderUploads(files: UploadedOrderFile[]) {
  const publicIds = files
    .map((file) => file.publicId)
    .filter((publicId): publicId is string => publicId.trim().length > 0);

  if (publicIds.length === 0) {
    return;
  }

  await apiClient.post('/orders/uploads/cleanup', {
    publicIds,
  });
}
