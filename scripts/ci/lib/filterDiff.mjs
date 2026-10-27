// Files that add noise/cost to a review without adding review value.
export const EXCLUDED_GLOBS = [
  'package-lock.json',
  'client/src/icons/sprite.gen.jsx',
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.webp',
  '*.gif',
  '*.ico',
  '*.svg',
  '*.pdf',
  '*.woff',
  '*.woff2',
  '*.ttf',
];

/** Convert a glob list into git pathspec exclusions for `git diff -- . <specs>`. */
export function excludePathspecs(globs = EXCLUDED_GLOBS) {
  return globs.map((g) => `:(exclude)${g}`);
}
