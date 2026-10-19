export function bodyMarkup(documentSource) {
  const body = documentSource.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '';
  return body.replace(/\s*<script[^>]*>[\s\S]*?<\/script>\s*/gi, '');
}
