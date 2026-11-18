import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import RoomChat from '../src/components/RoomChat';

describe('RoomChat Component (Phase P2)', () => {
  const sampleProducts = [
    { id: 'p1', name: 'Ergonomic Desk Chair' },
    { id: 'p2', name: 'boAt Stone Speaker' },
  ];

  const sampleMessages = [
    {
      id: 'm1',
      roomId: 'room-1',
      participantId: 'user-2',
      participantName: 'Bob',
      text: 'Hey everyone, check this chair out!',
      productId: 'p1',
      createdAt: '2026-10-29T10:00:00.000Z',
    },
    {
      id: 'm2',
      roomId: 'room-1',
      participantId: 'user-1',
      participantName: 'Alice',
      text: 'I really love the lumbar support on it.',
      productId: null,
      createdAt: '2026-10-29T10:01:00.000Z',
    },
  ];

  it('renders empty state when there are no messages', () => {
    render(
      <RoomChat
        messages={[]}
        currentParticipant={{ id: 'user-1', name: 'Alice' }}
        onSendMessage={() => {}}
        isJoined={true}
      />
    );

    expect(screen.getByText(/Say hi - your friends are deciding too/i)).toBeInTheDocument();
  });

  it('renders messages with sender names, plain text, and product tags', () => {
    render(
      <RoomChat
        messages={sampleMessages}
        currentParticipant={{ id: 'user-1', name: 'Alice' }}
        onSendMessage={() => {}}
        products={sampleProducts}
        isJoined={true}
      />
    );

    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Hey everyone, check this chair out!')).toBeInTheDocument();
    expect(screen.getAllByText(/About: Ergonomic Desk Chair/i)[0]).toBeInTheDocument();
    expect(screen.getByText('I really love the lumbar support on it.')).toBeInTheDocument();
  });

  it('displays typing indicators for active typing participants', () => {
    render(
      <RoomChat
        messages={sampleMessages}
        currentParticipant={{ id: 'user-1', name: 'Alice' }}
        onSendMessage={() => {}}
        typingUsers={[{ participantId: 'user-2', participantName: 'Bob' }]}
        isJoined={true}
      />
    );

    expect(screen.getByText(/Bob is typing.../i)).toBeInTheDocument();
  });

  it('displays online presence count badge', () => {
    render(
      <RoomChat
        messages={sampleMessages}
        currentParticipant={{ id: 'user-1', name: 'Alice' }}
        onSendMessage={() => {}}
        onlineParticipants={['user-1', 'user-2', 'user-3']}
        isJoined={true}
      />
    );

    expect(screen.getByText(/3 online/i)).toBeInTheDocument();
  });

  it('calls onSendMessage when input is submitted via button or Enter', async () => {
    const handleSend = vi.fn().mockResolvedValue({});
    render(
      <RoomChat
        messages={sampleMessages}
        currentParticipant={{ id: 'user-1', name: 'Alice' }}
        onSendMessage={handleSend}
        products={sampleProducts}
        isJoined={true}
      />
    );

    const input = screen.getByLabelText(/chat message/i);
    fireEvent.change(input, { target: { value: 'Voting now!' } });

    const sendBtn = screen.getByRole('button', { name: /send message/i });
    await act(async () => {
      fireEvent.click(sendBtn);
    });

    expect(handleSend).toHaveBeenCalledWith('Voting now!', null);
  });

  it('displays disconnected state banner and disables input when disconnected', () => {
    render(
      <RoomChat
        messages={sampleMessages}
        currentParticipant={{ id: 'user-1', name: 'Alice' }}
        onSendMessage={() => {}}
        isConnected={false}
        isJoined={true}
      />
    );

    expect(screen.getByText(/Reconnecting to live chat/i)).toBeInTheDocument();
    const input = screen.getByLabelText(/chat message/i);
    expect(input).toBeDisabled();
  });

  it('displays error and retry action when send fails', async () => {
    const handleSend = vi.fn().mockRejectedValue(new Error('Connection lost'));
    render(
      <RoomChat
        messages={sampleMessages}
        currentParticipant={{ id: 'user-1', name: 'Alice' }}
        onSendMessage={handleSend}
        isJoined={true}
      />
    );

    const input = screen.getByLabelText(/chat message/i);
    fireEvent.change(input, { target: { value: 'Failed message' } });

    const sendBtn = screen.getByRole('button', { name: /send message/i });
    await act(async () => {
      fireEvent.click(sendBtn);
    });

    expect(screen.getByText(/Connection lost/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
