export function validateMedia(buffer, mime) {
  if (!buffer.length || buffer.length > 10 * 1024 * 1024) throw new Error('File must be between 1 byte and 10 MB');
  const valid = mime === 'application/pdf' ? buffer.subarray(0, 5).toString() === '%PDF-'
    : mime === 'image/png' ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : mime === 'image/jpeg' ? buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
    : mime === 'image/webp' ? buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'
    : false;
  if (!valid) throw new Error('File content does not match a supported image or PDF');
}
