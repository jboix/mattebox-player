import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Connect, Plugin } from 'vite';

/** Where the dev server serves the engine's streams. */
export const ENGINE_STREAMS = '/engine-streams';

/**
 * The engine's generated corpus, in the engine's repository beside this one:
 * `test/e2e/gen-streams.sh` writes it to `test/fixtures/streams`. The hosted
 * demo reads the engine's site instead, which serves the same files.
 */
const ROOT = fileURLToPath(new URL('../../mattebox/test/fixtures/streams', import.meta.url));

const TYPES: Readonly<Record<string, string>> = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.mpd': 'application/dash+xml',
  '.m4s': 'video/mp4',
  '.mp4': 'video/mp4',
  '.json': 'application/json',
  '.vtt': 'text/vtt',
  '.ttml': 'application/ttml+xml',
  '.ts': 'video/mp2t',
  '.aac': 'audio/aac',
};

const serve: Connect.NextHandleFunction = (req, res, next) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT + sep)) {
    next();
    return;
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end(
      existsSync(ROOT)
        ? `${path} is not in ${ROOT}: run test/e2e/gen-streams.sh in the engine.`
        : `No engine beside the player at ${ROOT}.`,
    );
    return;
  }
  res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
  res.setHeader('Access-Control-Allow-Origin', '*');
  createReadStream(file).pipe(res);
};

/** Serves the engine's streams on the dev server, so the demo plays them without the engine's site. */
export function engineStreams(): Plugin {
  return {
    name: 'mattebox-engine-streams',
    configureServer(server) {
      server.middlewares.use(ENGINE_STREAMS, serve);
    },
  };
}
