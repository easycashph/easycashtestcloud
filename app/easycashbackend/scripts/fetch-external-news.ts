/**
 * Manual one-off runner for FetchExternalFinanceNewsUseCase (2026-08-06) - run this BEFORE relying
 * on the daily cron to confirm the configured feed URLs are actually reachable from this host.
 * Feed reachability could not be verified during planning (WebFetch from that environment got
 * HTTP 403 from every candidate source tried) - this script is how to check for real.
 *
 * Usage: npx tsx scripts/fetch-external-news.ts
 */
import 'dotenv/config';
import { env } from '../src/shared/config/env';
import { prisma } from '../src/shared/database/prismaClient';
import { FetchExternalFinanceNewsUseCase, RssParserAdapter, type FeedSource } from '../src/modules/finance-news/application/use-cases/FetchExternalFinanceNewsUseCase';
import { PrismaExternalNewsLinkRepository } from '../src/modules/finance-news/infrastructure/PrismaExternalNewsLinkRepository';

function parseFeedUrls(commaSeparated: string, category: 'FINANCE' | 'ADVISORY'): FeedSource[] {
  return commaSeparated
    .split(',')
    .map((url) => url.trim())
    .filter((url) => url.length > 0)
    .map((url) => ({ url, category }));
}

async function main(): Promise<void> {
  const feeds = [...parseFeedUrls(env.FINANCE_NEWS_FEED_URLS, 'FINANCE'), ...parseFeedUrls(env.ADVISORY_NEWS_FEED_URLS, 'ADVISORY')];
  if (feeds.length === 0) {
    console.log('No feed URLs configured - set FINANCE_NEWS_FEED_URLS and/or ADVISORY_NEWS_FEED_URLS in .env first.');
    return;
  }

  console.log(`Fetching ${feeds.length} feed(s)...`);
  const useCase = new FetchExternalFinanceNewsUseCase({
    externalNewsLinkRepository: new PrismaExternalNewsLinkRepository(),
    rssFeedParser: new RssParserAdapter(),
  });
  const result = await useCase.execute(feeds);
  console.log(JSON.stringify(result, null, 2));

  if (result.feedErrors.length > 0) {
    console.log('\nSome feeds failed - check reachability/URL correctness from this host:');
    for (const err of result.feedErrors) console.log(`  ${err.url}: ${err.error}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
