import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { scanActiveTab } from './extension/scanClient';
import type { ScanPayload } from './extension/scanTypes';

vi.mock('./extension/scanClient', () => ({
  emptyScanMeta: () => ({
    page: { status: 'unavailable', message: 'Page scan has not run.' },
    tls: { status: 'unavailable', message: 'TLS scan has not run.' },
    certificates: { status: 'unavailable', message: 'Certificate scan has not run.' },
    warnings: [],
  }),
  scanActiveTab: vi.fn(),
}));

afterEach(() => {
  vi.mocked(scanActiveTab).mockReset();
});

test('renders the Floun popup shell', () => {
  render(<App />);

  expect(screen.getByAltText(/floun logo/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /scan/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /generate report/i })).not.toBeInTheDocument();
});

test('renders expandable finding rows with structured explanation fields', async () => {
  const payload: ScanPayload = {
    jsScripts: [{ type: 'inline', content: 'const digest = MD5(input);' }],
    tokens: ['secretRawToken'],
    headers: {},
    TLS: {
      provider: 'ssl-labs',
      endpoints: [{
        protocolVersions: ['1.3'],
        cipherSuites: ['TLS_AES_128_GCM_SHA256'],
      }],
    },
    certificates: { provider: 'ssl-checker', signatureAlgorithm: 'sha256WithRSAEncryption' },
    scanMeta: {
      page: { status: 'complete' },
      tls: { status: 'complete' },
      certificates: { status: 'complete' },
      warnings: [],
    },
  };
  vi.mocked(scanActiveTab).mockResolvedValue(payload);

  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /scan/i }));

  const findingTitle = await screen.findByText('Found MD5 Hashing');
  const findingSummary = findingTitle.closest('summary');

  expect(findingSummary).toBeTruthy();
  fireEvent.click(findingSummary as HTMLElement);
  expect(screen.getByText(/MD5 is a known deprecated hash/)).toBeInTheDocument();
  expect(screen.getByText(/The match does not determine whether usage is security-sensitive/)).toBeInTheDocument();
  expect(screen.getByText(/Remove MD5/)).toBeInTheDocument();
  expect(screen.getByText(/Status: Deprecated/)).toBeInTheDocument();

  const links = screen.getAllByRole('link', { name: /reference 1/i });
  expect(links[0]).toHaveAttribute('target', '_blank');
  expect(links[0]).toHaveAttribute('rel', 'noreferrer');

  await waitFor(() => {
    expect(document.body.textContent).not.toContain('secretRawToken');
  });
});
