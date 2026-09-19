/**
 * A valid WAV, so a native session in a hermetic test reaches `loadedmetadata`
 * instead of a MediaError. 8-bit mono at 8 kHz, an eighth of a second of
 * silence by default, the smallest file a browser will actually decode;
 * longer where a test seeks.
 */
export function silence(seconds = 0.125): string {
  const samples = Math.round(seconds * 8000);
  const bytes = new Uint8Array(44 + samples).fill(128, 44);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  ascii(36, 'data');
  view.setUint32(40, samples, true);
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
}

/** Resolves on the next `name` event from `target`. */
export function once(target: EventTarget, name: string): Promise<Event> {
  return new Promise((resolve) => {
    target.addEventListener(name, resolve, { once: true });
  });
}
