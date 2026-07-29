import * as React from 'react';
import { COMPANY } from '@/lib/companyInfo';

/**
 * Sets the document title (and optionally the meta description) for the current route.
 *
 * WHY: this is a single-page app, so without this every route keeps the one title baked into
 * index.html. That hurts three things at once - browser tabs and history entries are
 * indistinguishable, shared links all preview identically, and screen readers announce the same
 * page name on every navigation (WCAG 2.4.2 "Page Titled").
 *
 * Titles follow "<Page> | Easycash" so the brand is always visible but never leads.
 * Pass `title: null` on the landing page to keep index.html's fuller marketing title.
 */
export function usePageMeta(title: string | null, description?: string) {
  React.useEffect(() => {
    const previousTitle = document.title;

    if (title) document.title = `${title} | ${COMPANY.shortName}`;

    let previousDescription: string | undefined;
    const tag = description
      ? document.querySelector<HTMLMetaElement>('meta[name="description"]')
      : null;
    if (tag) {
      previousDescription = tag.content;
      tag.content = description!;
    }

    // Restore on unmount so a route that sets no meta never inherits the previous route's.
    return () => {
      document.title = previousTitle;
      if (tag && previousDescription !== undefined) tag.content = previousDescription;
    };
  }, [title, description]);
}
