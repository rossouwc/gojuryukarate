import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Recomputed at server startup and on every publish build. Only changed images
// receive new URLs; unchanged images can still use the browser cache.
export function imageVersions(publicRoot) {
  return Object.fromEntries(
    readdirSync(join(publicRoot, 'images'))
      .filter(name => /\.(jpe?g|png|webp|gif|avif)$/i.test(name))
      .sort()
      .map(name => [
        `images/${name}`,
        createHash('sha256')
          .update(readFileSync(join(publicRoot, 'images', name)))
          .digest('hex')
          .slice(0, 16),
      ]),
  );
}
