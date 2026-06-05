import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the Floun popup shell', () => {
  render(<App />);

  expect(screen.getByAltText(/floun logo/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /scan/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /generate report/i })).not.toBeInTheDocument();
});

