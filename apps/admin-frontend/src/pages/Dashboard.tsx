import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminRooms, getAdminUsers } from '@/lib/api';
import { DoorOpen, Users, PlayCircle, TrendingUp } from 'lucide-react';

interface Stats {
  totalRooms: number;
  activeRooms: number;
  totalUsers: number;
  playersOnline: number;
}

export function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalRooms: 0,
    activeRooms: 0,
    totalUsers: 0,
    playersOnline: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);

    const [roomsResult, usersResult] = await Promise.all([getAdminRooms(), getAdminUsers()]);

    if (roomsResult.success && roomsResult.data && usersResult.success && usersResult.data) {
      const rooms = roomsResult.data;
      const activeRooms = rooms.filter((r) => r.status !== 'closed');
      const playersOnline = rooms.reduce((acc, r) => acc + r.currentPlayerCount, 0);

      setStats({
        totalRooms: rooms.length,
        activeRooms: activeRooms.length,
        totalUsers: usersResult.data.length,
        playersOnline,
      });
    }

    setLoading(false);
  };

  const statCards = [
    {
      label: 'Total Rooms',
      value: stats.totalRooms,
      icon: DoorOpen,
      color: 'bg-blue-500/10 text-blue-400',
      link: '/rooms',
    },
    {
      label: 'Active Rooms',
      value: stats.activeRooms,
      icon: PlayCircle,
      color: 'bg-green-500/10 text-green-400',
      link: '/rooms',
    },
    {
      label: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-purple-500/10 text-purple-400',
      link: '/users',
    },
    {
      label: 'Players Online',
      value: stats.playersOnline,
      icon: TrendingUp,
      color: 'bg-yellow-500/10 text-yellow-400',
      link: '/rooms',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your poker platform</p>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link
                key={stat.label}
                to={stat.link}
                className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-colors"
              >
                <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="text-3xl font-bold">{stat.value}</div>
                <div className="text-muted-foreground mt-1">{stat.label}</div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              to="/rooms"
              className="flex items-center gap-3 p-3 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
            >
              <DoorOpen className="w-5 h-5 text-primary" />
              <span>Create New Room</span>
            </Link>
            <Link
              to="/users"
              className="flex items-center gap-3 p-3 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
            >
              <Users className="w-5 h-5 text-primary" />
              <span>Manage Users</span>
            </Link>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Platform Info</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Game Type</span>
              <span>Texas Hold'em (No Limit)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Turn Timer</span>
              <span>30 seconds</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max Players per Table</span>
              <span>9</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Signup Bonus</span>
              <span>50,000 chips</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
