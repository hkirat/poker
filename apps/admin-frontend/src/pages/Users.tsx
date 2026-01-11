import { useEffect, useState } from 'react';
import { getAdminUsers, updateUserAdmin } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { ShieldCheck, ShieldOff, Search } from 'lucide-react';
import { clsx } from 'clsx';

interface User {
  id: string;
  email: string;
  username: string;
  balance: number;
  isAdmin: boolean;
  createdAt: string;
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const currentUser = useAuthStore((s) => s.user);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const result = await getAdminUsers();
    if (result.success && result.data) {
      setUsers(result.data);
    }
    setLoading(false);
  };

  const handleToggleAdmin = async (user: User) => {
    if (user.id === currentUser?.id) {
      alert("You cannot change your own admin status");
      return;
    }

    const result = await updateUserAdmin(user.id, !user.isAdmin);
    if (result.success) {
      fetchUsers();
    } else {
      alert(result.error || 'Failed to update user');
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.username.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground mt-1">Manage platform users</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring w-64"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {search ? 'No users found matching your search' : 'No users yet'}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-secondary">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                  Username
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                  Email
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                  Balance
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                  Role
                </th>
                <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">
                  Joined
                </th>
                <th className="text-right px-6 py-4 text-sm font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {user.username[0].toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium">{user.username}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className="text-yellow-400 font-medium">
                      {user.balance.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={clsx(
                        'px-2 py-1 rounded text-xs font-medium',
                        user.isAdmin
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-gray-500/20 text-gray-400'
                      )}
                    >
                      {user.isAdmin ? 'Admin' : 'Player'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleToggleAdmin(user)}
                      disabled={user.id === currentUser?.id}
                      className={clsx(
                        'p-2 rounded-lg transition-colors',
                        user.id === currentUser?.id
                          ? 'text-muted-foreground cursor-not-allowed'
                          : user.isAdmin
                          ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                          : 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10'
                      )}
                      title={
                        user.id === currentUser?.id
                          ? 'Cannot change your own status'
                          : user.isAdmin
                          ? 'Remove admin'
                          : 'Make admin'
                      }
                    >
                      {user.isAdmin ? (
                        <ShieldOff className="w-4 h-4" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 text-sm text-muted-foreground">
        Showing {filteredUsers.length} of {users.length} users
      </div>
    </div>
  );
}
