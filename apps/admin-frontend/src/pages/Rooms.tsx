import { useEffect, useState } from 'react';
import { getAdminRooms, createRoom, updateRoomStatus, deleteRoom } from '@/lib/api';
import { Plus, Trash2, X, Users } from 'lucide-react';
import { clsx } from 'clsx';

interface Room {
  id: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  maxPlayers: number;
  status: string;
  currentPlayerCount: number;
  createdAt: string;
}

export function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    setLoading(true);
    const result = await getAdminRooms();
    if (result.success && result.data) {
      setRooms(result.data);
    }
    setLoading(false);
  };

  const handleStatusChange = async (roomId: string, status: string) => {
    const result = await updateRoomStatus(roomId, status);
    if (result.success) {
      fetchRooms();
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('Are you sure you want to delete this room?')) return;
    const result = await deleteRoom(roomId);
    if (result.success) {
      fetchRooms();
    } else {
      alert(result.error || 'Failed to delete room');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Rooms</h1>
          <p className="text-muted-foreground mt-1">Manage poker tables</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Room
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No rooms created yet. Create your first room!
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-secondary">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                  Name
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                  Blinds
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                  Buy-in
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                  Players
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-right px-6 py-4 text-sm font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rooms.map((room) => (
                <tr key={room.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-6 py-4 font-medium">{room.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {room.smallBlind} / {room.bigBlind}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {room.minBuyIn.toLocaleString()} - {room.maxBuyIn.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {room.currentPlayerCount} / {room.maxPlayers}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={room.status}
                      onChange={(e) => handleStatusChange(room.id, e.target.value)}
                      className={clsx(
                        'px-3 py-1 rounded text-sm font-medium border-0 cursor-pointer',
                        room.status === 'waiting' && 'bg-green-500/20 text-green-400',
                        room.status === 'playing' && 'bg-yellow-500/20 text-yellow-400',
                        room.status === 'closed' && 'bg-red-500/20 text-red-400'
                      )}
                    >
                      <option value="waiting">Open</option>
                      <option value="playing">In Progress</option>
                      <option value="closed">Closed</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDeleteRoom(room.id)}
                      disabled={room.currentPlayerCount > 0}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={
                        room.currentPlayerCount > 0
                          ? 'Cannot delete room with players'
                          : 'Delete room'
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <CreateRoomModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchRooms();
          }}
        />
      )}
    </div>
  );
}

function CreateRoomModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [smallBlind, setSmallBlind] = useState(10);
  const [maxPlayers, setMaxPlayers] = useState(9);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const bigBlind = smallBlind * 2;
  const minBuyIn = bigBlind * 20;
  const maxBuyIn = bigBlind * 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await createRoom({
      name,
      smallBlind,
      bigBlind,
      minBuyIn,
      maxBuyIn,
      maxPlayers,
    });

    if (result.success) {
      onCreated();
    } else {
      setError(result.error || 'Failed to create room');
    }

    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl p-6 max-w-md w-full border border-border">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Create New Room</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Room Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g., High Stakes Table"
              minLength={3}
              maxLength={50}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Small Blind
            </label>
            <input
              type="number"
              value={smallBlind}
              onChange={(e) => setSmallBlind(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              min={1}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">Big blind will be {bigBlind}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Max Players
            </label>
            <select
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <option key={n} value={n}>
                  {n} players
                </option>
              ))}
            </select>
          </div>

          <div className="bg-secondary rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Blinds</span>
              <span>
                {smallBlind} / {bigBlind}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Min Buy-in (20 BB)</span>
              <span>{minBuyIn.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max Buy-in (100 BB)</span>
              <span>{maxBuyIn.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
