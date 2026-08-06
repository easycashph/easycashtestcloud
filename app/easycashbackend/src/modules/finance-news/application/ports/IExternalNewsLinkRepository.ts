export type ExternalNewsCategory = 'FINANCE' | 'ADVISORY';

export interface ExternalNewsLinkRecord {
  id: string;
  category: ExternalNewsCategory;
  title: string;
  sourceName: string;
  sourceUrl: string;
  excerpt: string;
  publishedAt: Date;
  fetchedAt: Date;
}

export interface CreateExternalNewsLinkInput {
  category: ExternalNewsCategory;
  title: string;
  sourceName: string;
  sourceUrl: string;
  excerpt: string;
  publishedAt: Date;
}

export interface ListExternalNewsLinksOptions {
  category?: ExternalNewsCategory;
  limit: number;
}

export interface IExternalNewsLinkRepository {
  /** Dedupe check - the fetch job skips a URL it has already stored. */
  findBySourceUrl(sourceUrl: string): Promise<ExternalNewsLinkRecord | null>;
  create(input: CreateExternalNewsLinkInput): Promise<ExternalNewsLinkRecord>;
  /** Newest (`publishedAt`) first. */
  findMany(options: ListExternalNewsLinksOptions): Promise<ExternalNewsLinkRecord[]>;
}
