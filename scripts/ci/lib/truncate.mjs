/**
 * Remove incomplete UTF-8 sequences from the end of a buffer.
 * Walks back up to 3 bytes looking for a lead byte whose declared sequence
 * length exceeds the bytes remaining in the slice.
 */
function trimIncompleteUtf8(buf) {
  let cut = buf.length;
  for (let back = 1; back <= 3 && cut - back >= 0; back++) {
    const byte = buf[cut - back];
    if ((byte & 0xc0) === 0x80) continue; // continuation byte — keep walking back
    let seqLen = 1;
    if ((byte & 0xe0) === 0xc0) seqLen = 2;
    else if ((byte & 0xf0) === 0xe0) seqLen = 3;
    else if ((byte & 0xf8) === 0xf0) seqLen = 4;
    if (seqLen > back) cut -= back; // incomplete trailing sequence — trim it off
    break;
  }
  return buf.subarray(0, cut);
}

/**
 * Truncate `text` to at most `maxBytes` UTF-8 bytes, appending `notice`
 * (not counted against the cap) when truncation happens.
 * Correctly handles multi-byte UTF-8 characters without producing replacement chars.
 */
export function truncateText(text, maxBytes, { notice = '' } = {}) {
  const buf = Buffer.from(text, 'utf8');
  if (buf.byteLength <= maxBytes) {
    return { text, truncated: false };
  }
  const sliced = buf.subarray(0, maxBytes);
  const trimmed = trimIncompleteUtf8(sliced);
  const cut = trimmed.toString('utf8');
  return { text: cut + notice, truncated: true };
}
