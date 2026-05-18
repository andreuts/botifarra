// ---------------------------------------------------------------------------
// News DTOs
// ---------------------------------------------------------------------------

export interface NewsPostSummaryDTO {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImageUrl: string | null;
  publishedAt: string | null;
  authorUsername: string | null;
  createdAt: string;
}

export interface NewsPostDetailDTO extends NewsPostSummaryDTO {
  bodyHtml: string;
  updatedAt: string;
}

export interface NewsPostListDTO {
  posts: NewsPostSummaryDTO[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateNewsPostRequest {
  title: string;
  bodyHtml: string;
  excerpt?: string;
  isPublished?: boolean;
  publishedAt?: string;
  featuredImageUrl?: string;
}

export type UpdateNewsPostRequest = Partial<CreateNewsPostRequest>;
