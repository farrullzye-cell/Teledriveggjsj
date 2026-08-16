import test from 'node:test';
import assert from 'node:assert/strict';

import { matchSelectedRemoteSource, normalizeRemoteSourceUrl } from '../lib/remote-source.ts';

test('normalizeRemoteSourceUrl strips query strings and trailing slash', () => {
  assert.equal(normalizeRemoteSourceUrl('https://www.terabox.com/file/abc?download=1/'), 'https://www.terabox.com/file/abc');
});

test('matchSelectedRemoteSource works for terabox URLs and legacy telegram_url keys', () => {
  const allFiles = [
    { id: 'file_1', name: 'video.mp4', terabox_url: 'https://www.terabox.com/file/abc', telegram_file_id: '' },
    { id: 'file_2', name: 'doc.pdf', source_url: 'https://example.com/file.pdf', telegram_file_id: '' },
    { id: 'file_3', name: 'archive.zip', telegram_file_id: 'tg-123' },
  ];

  const matched = allFiles.filter((file) => matchSelectedRemoteSource(file, [
    { terabox_url: 'https://www.terabox.com/file/abc?download=1' },
    { source_url: 'https://example.com/file.pdf' },
  ]));

  assert.deepEqual(matched.map((file) => file.id), ['file_1', 'file_2']);
});
