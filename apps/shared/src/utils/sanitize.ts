export const sanitizeInput = (input: string): string => {
  return input.replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const ALLOWED_TAGS = new Set([
  'b',
  'i',
  'u',
  'strong',
  'em',
  'p',
  'br',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'a',
]);

export const sanitizeRichText = (input: string): string => {
  return input.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/gi, (match, tag, attrs) => {
    const tagLower = tag.toLowerCase();
    const isClosing = match.startsWith('</');

    if (!ALLOWED_TAGS.has(tagLower)) {
      return match.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    if (isClosing) {
      return `</${tagLower}>`;
    }

    let safeAttrs = '';
    if (tagLower === 'a') {
      const hrefMatch = attrs.match(/href\s*=\s*"([^"]*?)"/i) || attrs.match(/href\s*=\s*'([^']*?)'/i);
      if (hrefMatch) {
        const href = hrefMatch[1];
        if (!/^\s*(javascript|data|vbscript):/i.test(href)) {
          safeAttrs = ` href="${href.replace(/"/g, '&quot;')}"`;
        }
      }
    }

    const selfClosing = tagLower === 'br' ? ' /' : '';
    return `<${tagLower}${safeAttrs}${selfClosing}>`;
  });
};

export const isValidColor = (color: string): boolean => {
  return /^#[0-9A-Fa-f]{6}$/.test(color) || /^[a-zA-Z]+$/.test(color);
};
