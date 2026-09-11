import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite';

/** The signed URL the demo's extensionless row points at. */
const SIGNED = '/signed/12345';

/** A WAV: 8000 samples of silence, 8-bit mono at 8 kHz. */
function wav(): Buffer {
  const samples = 8000;
  const bytes = Buffer.alloc(44 + samples, 128);
  bytes.write('RIFF', 0, 'ascii');
  bytes.writeUInt32LE(36 + samples, 4);
  bytes.write('WAVEfmt ', 8, 'ascii');
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24);
  bytes.writeUInt32LE(8000, 28);
  bytes.writeUInt16LE(1, 32);
  bytes.writeUInt16LE(8, 34);
  bytes.write('data', 36, 'ascii');
  bytes.writeUInt32LE(samples, 40);
  return bytes;
}

/**
 * Serves one media file at a URL with no extension, which is the shape of a
 * signed CDN URL. The extension says nothing, so the engine takes the source
 * on a maybe and asks for it; the audio Content-Type on the response is one
 * of the three routes to MANIFEST_UNSUPPORTED, and the engine declines
 * without downloading the body. The row then lands on the native handler
 * with something that plays. See docs/guide/02-handlers.md.
 *
 * The demo's dev and preview servers carry it, and so does the e2e suite's
 * Vite server, so the tests reach the row from their own origin.
 */
export function signedUrl(): Plugin {
  const body = wav();
  const serve: Connect.NextHandleFunction = (req, res, next) => {
    if (req.url?.split('?')[0] !== SIGNED) {
      next();
      return;
    }
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', String(body.length));
    res.end(req.method === 'HEAD' ? undefined : body);
  };
  return {
    name: 'demo-signed-url',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(serve);
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(serve);
    },
  };
}
