import { sanitizeUrl } from './media';

/** Convert BBCode to HTML for preview. */
export function bbcodeToHtml(input: string): string {
  if (!input) return '';

  let html = input
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Block tags
  html = html.replace(/\[h1\]([\s\S]*?)\[\/h1\]/gi, '<h1 class="text-xl font-bold text-neutral-900 dark:text-white mb-1">$1</h1>');
  html = html.replace(/\[h2\]([\s\S]*?)\[\/h2\]/gi, '<h2 class="text-lg font-semibold text-neutral-700 dark:text-neutral-300 mb-2">$1</h2>');
  html = html.replace(/\[h3\]([\s\S]*?)\[\/h3\]/gi, '<h3 class="text-base font-semibold text-neutral-700 dark:text-neutral-300 mb-1">$1</h3>');

  // Inline tags
  html = html.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>');
  html = html.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>');
  html = html.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>');
  html = html.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<s>$1</s>');

  // URLs — sanitize href to block javascript:/data: schemes
  html = html.replace(/\[url=(.*?)\]([\s\S]*?)\[\/url\]/gi, (_m, url, text) =>
    `<a href="${sanitizeUrl(url)}" target="_blank" rel="noreferrer" class="text-indigo-500 hover:text-indigo-400 underline">${text}</a>`);
  html = html.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, (_m, url) =>
    `<a href="${sanitizeUrl(url)}" target="_blank" rel="noreferrer" class="text-indigo-500 hover:text-indigo-400 underline">${url}</a>`);

  // Images — only allow http(s) sources
  html = html.replace(/\[img=(\d+)x(\d+)\](.*?)\[\/img\]/gi, (_m, w, h, src) =>
    `<img src="${sanitizeUrl(src)}" width="${w}" height="${h}" class="inline-block" loading="lazy" />`);
  html = html.replace(/\[img\](.*?)\[\/img\]/gi, (_m, src) =>
    `<img src="${sanitizeUrl(src)}" class="max-w-full rounded-lg my-1" loading="lazy" />`);

  // Tables
  html = html.replace(/\[table\]/gi, '<table class="w-full text-xs border-collapse my-2">');
  html = html.replace(/\[\/table\]/gi, '</table>');
  html = html.replace(/\[tr\]/gi, '<tr>');
  html = html.replace(/\[\/tr\]/gi, '</tr>');
  html = html.replace(/\[th\]([\s\S]*?)\[\/th\]/gi, '<th class="border border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 px-2 py-1 text-left font-semibold">$1</th>');
  html = html.replace(/\[td\]([\s\S]*?)\[\/td\]/gi, '<td class="border border-neutral-300 dark:border-neutral-600 px-2 py-1">$1</td>');

  // Newlines to <br>
  html = html.replace(/\n/g, '<br/>');

  return html;
}
