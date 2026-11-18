import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ParticipantBar from '../src/components/ParticipantBar';
import ProductVoting from '../src/components/ProductVoting';
import ProductComments from '../src/components/ProductComments';

describe('ParticipantBar Component', () => {
  it('renders join form when participant is not joined', () => {
    render(<ParticipantBar participant={null} onJoin={() => {}} />);
    expect(screen.getByText(/Join this Shopping Room/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter your name or nickname/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Join Room/i })).toBeInTheDocument();
  });

  it('validates display name and prevents empty join submission', () => {
    const handleJoin = vi.fn();
    render(<ParticipantBar participant={null} onJoin={handleJoin} />);

    const input = screen.getByPlaceholderText(/Enter your name or nickname/i);
    const joinBtn = screen.getByRole('button', { name: /Join Room/i });

    // Try submitting with only spaces
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(joinBtn);

    expect(handleJoin).not.toHaveBeenCalled();
  });

  it('calls onJoin when a valid display name is entered', () => {
    const handleJoin = vi.fn();
    render(<ParticipantBar participant={null} onJoin={handleJoin} />);

    const input = screen.getByPlaceholderText(/Enter your name or nickname/i);
    const joinBtn = screen.getByRole('button', { name: /Join Room/i });

    fireEvent.change(input, { target: { value: 'Maya Patel' } });
    fireEvent.click(joinBtn);

    expect(handleJoin).toHaveBeenCalledWith('Maya Patel');
  });

  it('renders active participant banner and allows editing name', () => {
    const handleUpdateName = vi.fn();
    const participant = { id: 'p-1', name: 'Maya Patel' };

    render(
      <ParticipantBar
        participant={participant}
        participantsCount={2}
        onUpdateName={handleUpdateName}
      />
    );

    expect(screen.getByText(/Joined as/i)).toBeInTheDocument();
    expect(screen.getByText('Maya Patel')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/people in room/i)).toBeInTheDocument();

    // Click edit name
    const editBtn = screen.getByRole('button', { name: /edit display name/i });
    fireEvent.click(editBtn);

    const editInput = screen.getByLabelText(/edit your display name/i);
    expect(editInput).toHaveValue('Maya Patel');

    fireEvent.change(editInput, { target: { value: 'Maya P. (Architect)' } });
    const saveBtn = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);

    expect(handleUpdateName).toHaveBeenCalledWith('Maya P. (Architect)');
  });
});

describe('ProductVoting Component', () => {
  const totals = {
    Love: 3,
    Like: 1,
    No: 0,
    'Need more info': 2,
  };

  it('renders all four vote choices with totals', () => {
    render(
      <ProductVoting
        productId="prod-1"
        totals={totals}
        userVote="Love"
        isJoined={true}
        onVote={() => {}}
      />
    );

    expect(screen.getByText('Love')).toBeInTheDocument();
    expect(screen.getByText('Like')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.getByText('Need info')).toBeInTheDocument();

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('6 votes')).toBeInTheDocument();
  });

  it('highlights the user current vote with aria-pressed', () => {
    render(
      <ProductVoting
        productId="prod-1"
        totals={totals}
        userVote="Love"
        isJoined={true}
        onVote={() => {}}
      />
    );

    const loveBtn = screen.getByRole('button', { name: /vote love/i });
    const likeBtn = screen.getByRole('button', { name: /vote like/i });

    expect(loveBtn).toHaveAttribute('aria-pressed', 'true');
    expect(likeBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onVote when a joined participant clicks an option', () => {
    const handleVote = vi.fn();
    render(
      <ProductVoting
        productId="prod-1"
        totals={totals}
        userVote="Love"
        isJoined={true}
        onVote={handleVote}
      />
    );

    const likeBtn = screen.getByRole('button', { name: /vote like/i });
    fireEvent.click(likeBtn);

    expect(handleVote).toHaveBeenCalledWith('prod-1', 'Like');
  });

  it('triggers onPromptJoin when an unjoined participant tries to vote', () => {
    const handlePromptJoin = vi.fn();
    const handleVote = vi.fn();

    render(
      <ProductVoting
        productId="prod-1"
        totals={totals}
        userVote={null}
        isJoined={false}
        onVote={handleVote}
        onPromptJoin={handlePromptJoin}
      />
    );

    const loveBtn = screen.getByRole('button', { name: /vote love/i });
    fireEvent.click(loveBtn);

    expect(handlePromptJoin).toHaveBeenCalled();
    expect(handleVote).not.toHaveBeenCalled();
  });
});

describe('ProductComments Component', () => {
  const sampleComments = [
    {
      id: 'c-1',
      participantId: 'p-1',
      participantName: 'Alice',
      text: 'Great ergonomic design!',
      createdAt: '2026-10-15T10:00:00.000Z',
    },
    {
      id: 'c-2',
      participantId: 'p-2',
      participantName: 'Bob',
      text: 'Does it fit under standard desks?',
      createdAt: '2026-10-15T10:05:00.000Z',
    },
  ];

  it('displays comments count and expands on click', () => {
    render(
      <ProductComments
        productId="prod-1"
        comments={sampleComments}
        isJoined={true}
        onPostComment={() => {}}
      />
    );

    expect(screen.getByText('2')).toBeInTheDocument();

    // Expand
    const toggleBtn = screen.getByRole('button', { name: /comments 2/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText('Great ergonomic design!')).toBeInTheDocument();
    expect(screen.getByText('Does it fit under standard desks?')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows empty state when no comments exist', () => {
    render(
      <ProductComments
        productId="prod-1"
        comments={[]}
        isJoined={true}
        onPostComment={() => {}}
      />
    );

    // Expand
    const toggleBtn = screen.getByRole('button', { name: /comments 0/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
  });

  it('shows character counter and posts valid comment', async () => {
    const handlePost = vi.fn().mockResolvedValue({});
    render(
      <ProductComments
        productId="prod-1"
        comments={[]}
        isJoined={true}
        onPostComment={handlePost}
      />
    );

    // Expand
    const toggleBtn = screen.getByRole('button', { name: /comments 0/i });
    fireEvent.click(toggleBtn);

    const textarea = screen.getByPlaceholderText(/write a comment or question/i);
    expect(screen.getByText(/0 \/ 500/)).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'This looks solid.' } });
    expect(screen.getByText(/17 \/ 500/)).toBeInTheDocument();

    const postBtn = screen.getByRole('button', { name: /post comment/i });
    await act(async () => {
      fireEvent.click(postBtn);
    });

    expect(handlePost).toHaveBeenCalledWith('prod-1', 'This looks solid.');
  });
});
