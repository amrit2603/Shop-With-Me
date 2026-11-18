import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DecisionSummary from '../src/components/DecisionSummary';

describe('DecisionSummary Component (Phase 6)', () => {
  const mockProduct1 = {
    id: 'prod-1',
    name: 'Ergonomic Desk Chair',
    price: 12999,
    category: 'Furniture',
    imageUrl: 'https://images.unsplash.com/photo-1580481077195-c3a8b30f7262?w=500&auto=format&fit=crop&q=60',
  };

  const mockProduct2 = {
    id: 'prod-2',
    name: 'Mechanical Keyboard',
    price: 7499,
    category: 'Electronics',
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=60',
  };

  it('renders nothing when summary is null or undefined', () => {
    const { container } = render(<DecisionSummary summary={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders helpful empty state when room has no products', () => {
    const summary = {
      status: 'no_products',
      rankings: [],
    };

    render(<DecisionSummary summary={summary} />);
    expect(screen.getByText(/Final Decision Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/No products to evaluate/i)).toBeInTheDocument();
    expect(screen.getByText(/Add products to this room and cast votes/i)).toBeInTheDocument();
  });

  it('renders insufficient data banner when products exist but no votes have been cast', () => {
    const summary = {
      status: 'insufficient_data',
      rankings: [
        {
          product: mockProduct1,
          score: 0,
          voteCount: 0,
          rank: 1,
          breakdown: { Love: 0, Like: 0, 'Need more info': 0, No: 0 },
          feedbackSummary: { hasFeedback: false, advantages: [], concerns: [], unresolvedQuestions: [] },
          commentCount: 0,
        },
      ],
    };

    render(<DecisionSummary summary={summary} />);
    expect(screen.getByText(/Not enough voting data yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Products are selected, but no participants have voted/i)).toBeInTheDocument();
    expect(screen.getByText('Ergonomic Desk Chair')).toBeInTheDocument();
  });

  it('renders winner card with score, breakdown, and rankings', () => {
    const summary = {
      status: 'winner',
      winner: {
        product: mockProduct1,
        score: 5,
        voteCount: 2,
        rank: 1,
        breakdown: { Love: 1, Like: 1, 'Need more info': 0, No: 0 },
      },
      rankings: [
        {
          product: mockProduct1,
          score: 5,
          voteCount: 2,
          rank: 1,
          breakdown: { Love: 1, Like: 1, 'Need more info': 0, No: 0 },
          feedbackSummary: {
            hasFeedback: true,
            advantages: ['Super comfortable ergonomic lumbar support'],
            concerns: ['Assembly instructions could be clearer'],
            unresolvedQuestions: ['Does it come with caster wheels for hardwood?'],
          },
          commentCount: 3,
        },
        {
          product: mockProduct2,
          score: 2,
          voteCount: 1,
          rank: 2,
          breakdown: { Love: 0, Like: 1, 'Need more info': 0, No: 0 },
          feedbackSummary: {
            hasFeedback: false,
            advantages: [],
            concerns: [],
            unresolvedQuestions: [],
          },
          commentCount: 0,
        },
      ],
    };

    render(<DecisionSummary summary={summary} />);

    // Winner banner
    expect(screen.getByText(/Group Favorite/i)).toBeInTheDocument();
    expect(screen.getAllByText('Ergonomic Desk Chair')[0]).toBeInTheDocument();
    expect(screen.getByText(/Consensus Score:/i)).toBeInTheDocument();
    expect(screen.getByText(/5 pts/i)).toBeInTheDocument();

    // Feedback displayed on product card
    expect(screen.getByText(/Super comfortable ergonomic lumbar support/i)).toBeInTheDocument();
    expect(screen.getByText(/Assembly instructions could be clearer/i)).toBeInTheDocument();
    expect(screen.getByText(/Does it come with caster wheels for hardwood/i)).toBeInTheDocument();

    // Second product without feedback displays empty notice
    expect(screen.getByText(/No written comments submitted yet for this product/i)).toBeInTheDocument();
  });

  it('renders honest tie banner when two products share first place', () => {
    const summary = {
      status: 'tie',
      tiedWinners: [
        {
          product: mockProduct1,
          score: 3,
          voteCount: 1,
          breakdown: { Love: 1, Like: 0, 'Need more info': 0, No: 0 },
        },
        {
          product: mockProduct2,
          score: 3,
          voteCount: 1,
          breakdown: { Love: 1, Like: 0, 'Need more info': 0, No: 0 },
        },
      ],
      rankings: [
        {
          product: mockProduct1,
          score: 3,
          voteCount: 1,
          rank: 1,
          breakdown: { Love: 1, Like: 0, 'Need more info': 0, No: 0 },
          feedbackSummary: { hasFeedback: false },
          commentCount: 0,
        },
        {
          product: mockProduct2,
          score: 3,
          voteCount: 1,
          rank: 1,
          breakdown: { Love: 1, Like: 0, 'Need more info': 0, No: 0 },
          feedbackSummary: { hasFeedback: false },
          commentCount: 0,
        },
      ],
    };

    render(<DecisionSummary summary={summary} />);

    expect(screen.getByText(/Tie for #1 Choice/i)).toBeInTheDocument();
    expect(screen.getByText(/The group is evenly split!/i)).toBeInTheDocument();
    expect(screen.getAllByText('Ergonomic Desk Chair').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mechanical Keyboard').length).toBeGreaterThan(0);
  });

  it('toggles ranking formula explanation on button click', () => {
    const summary = {
      status: 'winner',
      winner: {
        product: mockProduct1,
        score: 3,
        voteCount: 1,
        rank: 1,
        breakdown: { Love: 1, Like: 0, 'Need more info': 0, No: 0 },
      },
      rankings: [
        {
          product: mockProduct1,
          score: 3,
          voteCount: 1,
          rank: 1,
          breakdown: { Love: 1, Like: 0, 'Need more info': 0, No: 0 },
          feedbackSummary: { hasFeedback: false },
          commentCount: 0,
        },
      ],
    };

    render(<DecisionSummary summary={summary} />);

    const toggleBtn = screen.getByRole('button', { name: /How ranking works/i });
    expect(screen.queryByText(/Formula & Scoring Rules/i)).not.toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.getByText(/Formula & Scoring Rules/i)).toBeInTheDocument();
    expect(screen.getByText(/\+3 points/i)).toBeInTheDocument();
    expect(screen.getByText(/\+2 points/i)).toBeInTheDocument();
    expect(screen.getByText(/\+1 point/i)).toBeInTheDocument();
    expect(screen.getByText(/0 points/i)).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.queryByText(/Formula & Scoring Rules/i)).not.toBeInTheDocument();
  });

  it('calls onScrollToProduct when clicking view in room button', () => {
    const handleScroll = vi.fn();
    const summary = {
      status: 'winner',
      winner: {
        product: mockProduct1,
        score: 3,
        voteCount: 1,
        rank: 1,
        breakdown: { Love: 1, Like: 0, 'Need more info': 0, No: 0 },
      },
      rankings: [
        {
          product: mockProduct1,
          score: 3,
          voteCount: 1,
          rank: 1,
          breakdown: { Love: 1, Like: 0, 'Need more info': 0, No: 0 },
          feedbackSummary: { hasFeedback: false },
          commentCount: 2,
        },
      ],
    };

    render(<DecisionSummary summary={summary} onScrollToProduct={handleScroll} />);

    const inspectBtn = screen.getByRole('button', { name: /View in Room \(2\)/i });
    fireEvent.click(inspectBtn);

    expect(handleScroll).toHaveBeenCalledWith('prod-1');
  });

  it('renders neutral comments under general notes without presenting them as highlights', () => {
    const summary = {
      status: 'winner',
      winner: {
        product: mockProduct1,
        score: 3,
        voteCount: 1,
        rank: 1,
        breakdown: { Love: 1, Like: 0, 'Need more info': 0, No: 0 },
      },
      rankings: [
        {
          product: mockProduct1,
          score: 3,
          voteCount: 1,
          rank: 1,
          breakdown: { Love: 1, Like: 0, 'Need more info': 0, No: 0 },
          feedbackSummary: {
            hasFeedback: true,
            advantages: [],
            concerns: [],
            unresolvedQuestions: [],
            otherFeedback: ['I saw this in the retail store yesterday'],
          },
          commentCount: 1,
        },
      ],
    };

    render(<DecisionSummary summary={summary} />);

    // Should NOT show highlights label
    expect(screen.queryByText(/Highlights:/i)).not.toBeInTheDocument();
    // Should show notes label and comment
    expect(screen.getByText(/Notes:/i)).toBeInTheDocument();
    expect(screen.getByText(/"I saw this in the retail store yesterday"/i)).toBeInTheDocument();
  });

  describe('Phase B: Final Choice Experience', () => {
    const summaryWithRanking = {
      status: 'winner',
      winner: {
        product: mockProduct1,
        score: 3,
        voteCount: 1,
        rank: 1,
        breakdown: { Love: 1, Like: 0, 'Need more info': 0, No: 0 },
      },
      rankings: [
        {
          product: mockProduct1,
          score: 3,
          voteCount: 1,
          rank: 1,
          breakdown: { Love: 1, Like: 0, 'Need more info': 0, No: 0 },
          feedbackSummary: { hasFeedback: false },
          commentCount: 0,
        },
      ],
    };

    it('shows "My Final Choice" action only to the authorized creator', () => {
      // 1. As guest (isCreator = false) -> button should NOT be rendered
      const { rerender } = render(
        <DecisionSummary summary={summaryWithRanking} isCreator={false} onSelectFinalChoice={vi.fn()} />
      );
      expect(screen.queryByText(/My Final Choice/i)).not.toBeInTheDocument();

      // 2. As creator (isCreator = true) -> button should be rendered
      rerender(
        <DecisionSummary summary={summaryWithRanking} isCreator={true} onSelectFinalChoice={vi.fn()} />
      );
      expect(screen.getByRole('button', { name: /My Final Choice/i })).toBeInTheDocument();
    });

    it('calls onSelectFinalChoice with product ID when creator clicks final choice button', () => {
      const handleSelect = vi.fn();
      render(
        <DecisionSummary
          summary={summaryWithRanking}
          isCreator={true}
          onSelectFinalChoice={handleSelect}
        />
      );

      const choiceBtn = screen.getByRole('button', { name: /My Final Choice/i });
      fireEvent.click(choiceBtn);

      expect(handleSelect).toHaveBeenCalledWith('prod-1');
    });

    it('renders official final choice decision card with product details, summary sentence, and feedback themes', () => {
      const summaryWithFinalChoice = {
        ...summaryWithRanking,
        finalProductId: 'prod-1',
        finalChoice: {
          product: mockProduct1,
          score: 3,
          voteCount: 1,
          rank: 1,
          breakdown: { Love: 1, Like: 0, 'Need more info': 0, No: 0 },
          summarySentence: 'Four of six participants gave this product a Love or Like. Price was the most frequently mentioned feedback theme.',
          feedbackSummary: {
            hasFeedback: true,
            advantages: ['Exceptional ergonomic design'],
            concerns: ['Shipping box was damaged'],
            unresolvedQuestions: ['Is there a lumbar pump?'],
            otherFeedback: ['Assembly took 20 minutes'],
          },
        },
      };

      render(<DecisionSummary summary={summaryWithFinalChoice} isCreator={true} onSelectFinalChoice={vi.fn()} />);

      // Official Final Choice banner
      expect(screen.getByText(/Official Final Choice/i)).toBeInTheDocument();
      expect(screen.getByText(/Four of six participants gave this product a Love or Like/i)).toBeInTheDocument();
      expect(screen.getByText(/Price was the most frequently mentioned feedback theme/i)).toBeInTheDocument();

      // Feedback themes
      expect(screen.getByText(/Exceptional ergonomic design/i)).toBeInTheDocument();
      expect(screen.getByText(/Shipping box was damaged/i)).toBeInTheDocument();
      expect(screen.getByText(/Is there a lumbar pump/i)).toBeInTheDocument();
      expect(screen.getByText(/Assembly took 20 minutes/i)).toBeInTheDocument();

      // Selected button state in leaderboard
      expect(screen.getByText(/✓ Final Choice/i)).toBeInTheDocument();
    });
  });
});

