import { useState, useEffect } from 'react';

const DashboardPage = ({ onBackToHome }) => {
  const [auditData, setAuditData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/audit')
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        setAuditData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Audit fetch error:', err);
        setError('Failed to load audit data: ' + err.message);
        setLoading(false);
      });
  }, []);

  const formatPrice = (paise) => {
    if (!paise) return '—';
    return `₹${(paise / 100).toLocaleString('en-IN')}`;
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const actionStats = auditData.reduce((acc, entry) => {
    acc[entry.action] = (acc[entry.action] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121212] text-[#E0E0E0]">
        <header className="border-b border-gray-700 px-6 py-4">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <button 
              onClick={onBackToHome}
              className="text-[#4FC3F7] hover:underline font-medium"
            >
              ← Back to Home
            </button>
            <h1 className="text-xl font-bold text-[#4FC3F7]">Merchant Dashboard</h1>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-12">
          <div className="text-center text-gray-400">Loading dashboard...</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#121212] text-[#E0E0E0]">
        <header className="border-b border-gray-700 px-6 py-4">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <button 
              onClick={onBackToHome}
              className="text-[#4FC3F7] hover:underline font-medium"
            >
              ← Back to Home
            </button>
            <h1 className="text-xl font-bold text-[#4FC3F7]">Merchant Dashboard</h1>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-12">
          <div className="text-center text-red-400">{error}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-[#E0E0E0]">
      {/* Header */}
      <header className="border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <button 
            onClick={onBackToHome}
            className="text-[#4FC3F7] hover:underline font-medium"
          >
            ← Back to Home
          </button>
          <h1 className="text-xl font-bold text-[#4FC3F7]">Merchant Dashboard</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Commerce Overview</h2>
          <p className="text-gray-400">
            Monitor your AI agent's performance, track transactions, and analyze customer interactions.
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="border border-gray-700 p-6">
            <h3 className="text-sm text-gray-400 mb-2">Total Actions</h3>
            <p className="text-3xl font-bold text-[#4FC3F7]">{auditData.length}</p>
          </div>
          <div className="border border-gray-700 p-6">
            <h3 className="text-sm text-gray-400 mb-2">Orders Created</h3>
            <p className="text-3xl font-bold text-[#4FC3F7]">{actionStats['order_created'] || 0}</p>
          </div>
          <div className="border border-gray-700 p-6">
            <h3 className="text-sm text-gray-400 mb-2">Payments Captured</h3>
            <p className="text-3xl font-bold text-[#4FC3F7]">{actionStats['payment_captured'] || 0}</p>
          </div>
          <div className="border border-gray-700 p-6">
            <h3 className="text-sm text-gray-400 mb-2">Upsells Shown</h3>
            <p className="text-3xl font-bold text-[#4FC3F7]">{actionStats['upsell_shown'] || 0}</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mb-12">
          <h3 className="text-xl font-semibold mb-4">Recent Activity</h3>
          <div className="border border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Timestamp</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Action</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Order ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {auditData.slice(0, 10).map((entry, index) => (
                  <tr key={index} className="border-t border-gray-700">
                    <td className="px-4 py-3 text-sm">{formatDate(entry.timestamp)}</td>
                    <td className="px-4 py-3 text-sm">{entry.action}</td>
                    <td className="px-4 py-3 text-sm font-mono">{entry.order_id || '—'}</td>
                    <td className="px-4 py-3 text-sm">{formatPrice(entry.amount_paise)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        entry.status === 'success' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                      }`}>
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Agent Performance */}
        <div className="mb-12">
          <h3 className="text-xl font-semibold mb-4">Agent Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-gray-700 p-6">
              <h4 className="font-medium mb-4">Tool Usage Distribution</h4>
              <div className="space-y-2">
                {Object.entries(actionStats).map(([action, count]) => (
                  <div key={action} className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">{action}</span>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border border-gray-700 p-6">
              <h4 className="font-medium mb-4">System Status</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Agent Status</span>
                  <span className="text-sm text-green-400">● Online</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Payment Gateway</span>
                  <span className="text-sm text-green-400">● Connected</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">AI Model</span>
                  <span className="text-sm text-gray-400">Claude 3.5 Sonnet</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Environment</span>
                  <span className="text-sm text-yellow-400">● Test Mode</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="border border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="px-4 py-3 border border-gray-600 hover:border-[#4FC3F7] hover:text-[#4FC3F7] transition-colors text-sm">
              View Full Audit Trail
            </button>
            <button className="px-4 py-3 border border-gray-600 hover:border-[#4FC3F7] hover:text-[#4FC3F7] transition-colors text-sm">
              Export Activity Report
            </button>
            <button className="px-4 py-3 border border-gray-600 hover:border-[#4FC3F7] hover:text-[#4FC3F7] transition-colors text-sm">
              Configure Agent Settings
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;