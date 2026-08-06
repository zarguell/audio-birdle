import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BirdCompletionCard from '@/utils/BirdCompletionCard';

const BIRD_A = {
  id: 'amerob',
  name: 'American Robin',
  scientificName: 'Turdus migratorius',
  audioUrl: ['/audio/amerob.mp3'],
  images: [
    { url: '/img/a1.jpg', attribution: { photographer: 'P1', license: 'CC BY' } },
    { url: '/img/a2.jpg' },
  ],
  facts: ['Common in backyards across North America.'],
  learnMoreUrl: 'https://example.com/amerob',
};

const BIRD_B = {
  id: 'eurrob',
  name: 'European Robin',
  scientificName: 'Erithacus rubecula',
  audioUrl: ['/audio/eurrob.mp3'],
  images: [
    { url: '/img/b1.jpg' },
    { url: '/img/b2.jpg' },
    { url: '/img/b3.jpg' },
  ],
  facts: [],
  learnMoreUrl: '',
};

const getImage = (container) => container.querySelector('img');

describe('BirdCompletionCard', () => {
  it('should render the first image by default', () => {
    const { container } = render(<BirdCompletionCard bird={BIRD_A} />);

    expect(getImage(container)).toHaveAttribute('src', '/img/a1.jpg');
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('should navigate between images', () => {
    const { container } = render(<BirdCompletionCard bird={BIRD_A} />);

    fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
    expect(getImage(container)).toHaveAttribute('src', '/img/a2.jpg');
    expect(screen.getByText('2 / 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Previous image' }));
    expect(getImage(container)).toHaveAttribute('src', '/img/a1.jpg');
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('should reset the image index when the bird changes', () => {
    const { container, rerender } = render(
      <BirdCompletionCard bird={BIRD_A} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
    expect(getImage(container)).toHaveAttribute('src', '/img/a2.jpg');

    // New bird (different id) must reset to its first image
    rerender(<BirdCompletionCard bird={BIRD_B} />);
    expect(getImage(container)).toHaveAttribute('src', '/img/b1.jpg');
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('should keep the image index when the same bird is re-rendered', () => {
    const { container, rerender } = render(
      <BirdCompletionCard bird={BIRD_A} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
    expect(getImage(container)).toHaveAttribute('src', '/img/a2.jpg');

    rerender(<BirdCompletionCard bird={BIRD_A} />);
    expect(getImage(container)).toHaveAttribute('src', '/img/a2.jpg');
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('should render nothing when bird is null', () => {
    const { container } = render(<BirdCompletionCard bird={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
