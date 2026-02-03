import DOMPurify from "dompurify";

interface SafeHtmlProps {
  html: string;
  className?: string;
  allowedTags?: string[];
  allowedAttr?: string[];
  allowDataAttr?: boolean;
}

const DEFAULT_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "a",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "blockquote",
  "code",
  "pre",
  "hr",
];

const DEFAULT_ALLOWED_ATTR = ["href", "target", "rel", "class"];

export function SafeHtml({
  html,
  className = "",
  allowedTags = DEFAULT_ALLOWED_TAGS,
  allowedAttr = DEFAULT_ALLOWED_ATTR,
  allowDataAttr = false,
}: SafeHtmlProps) {
  const sanitizedHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttr,
    ALLOW_DATA_ATTR: allowDataAttr,
  });

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
