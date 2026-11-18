import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChatPanel from '../src/components/ChatPanel';
import { getRoomMessages } from '../src/services/api';

vi.mock('../src/services/api', () => ({ getRoomMessages: vi.fn() }));

function fakeSocket() {
  const listeners = new Map();
  return {
    connected: true,
    on: (event, callback) => listeners.set(event, callback),
    off: (event) => listeners.delete(event),
    emit: vi.fn((event, payload, acknowledgement) => {
      if (event === 'chat:send') acknowledgement?.({ ok: true });
    }),
  };
}

function view(props = {}) {
  return render(<ChatPanel roomId="room-1" participant={{ id: 'p-1', name: 'Avery' }}
    participants={[{ id: 'p-1', name: 'Avery' }]} socket={fakeSocket()} connected isActive onUnreadChange={() => {}} {...props} />);
}

describe('ChatPanel states', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('shows a loading skeleton while history is pending', () => {
    getRoomMessages.mockReturnValue(new Promise(() => {}));
    view();
    expect(screen.getByLabelText('Loading chat history')).toBeInTheDocument();
  });

  it('shows the friendly empty state', async () => {
    getRoomMessages.mockResolvedValue({ messages: [], nextBefore: null });
    view();
    expect(await screen.findByText('Say hi — your friends are deciding too.')).toBeInTheDocument();
  });

  it('shows a retry path when history fails', async () => {
    getRoomMessages.mockRejectedValueOnce(new Error('Could not load chat. Please retry.'))
      .mockResolvedValueOnce({ messages: [], nextBefore: null });
    view();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load chat');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(getRoomMessages).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Say hi — your friends are deciding too.')).toBeInTheDocument();
  });

  it('renders persisted messages and sends on Enter', async () => {
    getRoomMessages.mockResolvedValue({ messages: [{ id: 'm1', participantId: 'p-2', participantName: 'Blair', text: 'Blue looks good', createdAt: '2026-10-29T10:00:00.000Z' }], nextBefore: null });
    const socket = fakeSocket();
    view({ socket, products: [{ id: 'prod-1', name: 'Blue mug' }] });
    expect(await screen.findByText('Blue looks good')).toBeInTheDocument();
    const input = screen.getByLabelText('Message friends');
    fireEvent.change(input, { target: { value: 'Agreed' } });
    fireEvent.change(screen.getByLabelText('Tag a product (optional)'), { target: { value: 'prod-1' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    await waitFor(() => expect(socket.emit).toHaveBeenCalledWith('chat:send', { text: 'Agreed', productId: 'prod-1' }, expect.any(Function)));
  });
  it('keeps the party conversation available when upgrading a minimized standard room', async () => {
    getRoomMessages.mockResolvedValue({messages:[],nextBefore:null});
    const props={roomId:'room-1',participant:{id:'p-1',name:'Avery'},participants:[],socket:fakeSocket(),connected:true,isActive:true};
    const panel=render(<ChatPanel {...props}/>);
    await screen.findByText('Say hi — your friends are deciding too.');
    fireEvent.click(screen.getByRole('button',{name:'Minimize'}));
    expect(screen.queryByRole('textbox',{name:'Message friends'})).not.toBeInTheDocument();
    panel.rerender(<ChatPanel {...props} compact/>);
    expect(screen.getByRole('textbox',{name:'Message friends'})).toBeVisible();
    expect(screen.queryByRole('button',{name:'Minimize'})).not.toBeInTheDocument();
  });

  it('sends no tag by default and after explicitly clearing a selected product', async () => {
    getRoomMessages.mockResolvedValue({messages:[],nextBefore:null});
    const socket=fakeSocket();
    view({socket,products:[{id:'prod-1',name:'Blue mug'}]});
    await screen.findByText('Say hi — your friends are deciding too.');
    const input=screen.getByLabelText('Message friends');
    fireEvent.change(input,{target:{value:'General conversation'}});
    fireEvent.keyDown(input,{key:'Enter'});
    await waitFor(()=>expect(socket.emit).toHaveBeenCalledWith('chat:send',{text:'General conversation',productId:null},expect.any(Function)));
    await waitFor(()=>expect(input).toHaveValue(''));
    const picker=screen.getByLabelText('Tag a product (optional)');
    fireEvent.change(picker,{target:{value:'prod-1'}});
    fireEvent.change(picker,{target:{value:''}});
    fireEvent.change(input,{target:{value:'Without a product'}});
    fireEvent.keyDown(input,{key:'Enter'});
    await waitFor(()=>expect(socket.emit).toHaveBeenCalledWith('chat:send',{text:'Without a product',productId:null},expect.any(Function)));
  });

});
