export interface ApiResponse<T = null> {
  success: boolean;
  message: string;
  data: T | null;
  timestamp: string;
}

export interface PaginatedApiResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  timestamp: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}
