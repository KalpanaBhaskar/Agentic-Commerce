import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const [auditData, setAuditData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAuditData = async () => {
    try {
      const response = await fetch('/api/audit');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setAuditData(data);
      setLastUpdated(new Date());
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Audit fetch error:', err);
      setError('Could not load audit data. Is the server running?');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
    const interval = setInterval(fetchAuditData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Calculate metrics
  const totalOrders = auditData.filter(entry => entry.action === 'order_created').length;
  const totalCaptured = auditData
    .filter(entry => entry.action === 'payment_captured')
    .reduce((sum, entry) => sum + (entry.amount_paise || 0), 0) / 100;
  const upsellsShown = auditData.filter(entry => entry.action === 'upsell_shown').length;
  const paymentFailed = auditData.filter(entry => entry.action === 'payment_failed').length;
  const linkSent = auditData.filter(entry => entry.action === 'link_sent').length;
  const failureRecoveryRate = paymentFailed > 0 ? ((linkSent / paymentFailed) * 100).toFixed(1) : '0.0';

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });
  };

  const formatAmount = (paise) => {
    if (!paise || paise === 0) return '—';
    return `₹${(paise / 100).toFixed(2)}`;
  };

  const formatOrderId = (orderId) => {
    if (!orderId) return '—';
    return '...' + orderId.slice(-8);
  };

  const truncateReasoning = (text) => {
    if (!text) return '—';
    return text.length > 60 ? text.slice(0, 60) + '...' : text;
  };

  const getActionBadge = (action) => {
    const badges = {
      'order_created': 'bg-blue-100 text-blue-800',
      'payment_captured': 'bg-green-100 text-green-800',
      'upsell_shown': 'bg-amber-100 text-amber-800',
      'payment_failed': 'bg-red-100 text-red-800',
      'retry_attempted': 'bg-orange-100 text-orange-800',
      'link_sent': 'bg-teal-100 text-teal-800'
    };
    return badges[action] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status) => {
    const colors = {
      'success': 'text-green-600',
      'failed': 'text-red-600',
      'retried': 'text-orange-600'
    };
    return colors[status] || 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121212] text-[#E0E0E0] flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-[#4FC3F7] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#121212] text-[#E0E0E0] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-4">{error}</p>
          <button 
            onClick={fetchAuditData}
            className="px-4 py-2 bg-[#4FC3F7] text-black rounded hover:bg-[#29B6F6]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-[#E0E0E0]">
      {/* Header */}
      <header className="border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-[#4FC3F7]">Merchant Dashboard</h1>
          <Link 
            to="/"
            className="text-[#4FC3F7] hover:underline font-medium"
          >
            ← Buyer Chat
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Revenue Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Card 1: Total Orders */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-3xl font-bold text-gray-900 mb-2">{totalOrders}</div>
            <div className="text-sm text-gray-600">Total Orders</div>
          </div>

          {/* Card 2: Total Captured */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-3xl font-bold text-gray-900 mb-2">₹{totalCaptured.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-sm text-gray-600">Total Captured (₹)</div>
          </div>

          {/* Card 3: Upsells Shown */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-3xl font-bold text-gray-900 mb-2">{upsellsShown}</div>
            <div className="text-sm text-gray-600">Upsells Shown</div>
          </div>

          {/* Card 4: Failure Recovery Rate */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-3xl font-bold text-gray-900 mb-2">{failureRecoveryRate}%</div>
            <div className="text-sm text-gray-600">Failure Recovery Rate</div>
          </div>
        </div>

        {/* Live Audit Feed */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Live Audit Feed</h2>
            {lastUpdated && (
              <div className="text-sm text-gray-400">
                Last updated: {formatTime(lastUpdated)}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Time</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Action</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Order ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Agent Reasoning</th>
                </tr>
              </thead>
              <tbody>
                {auditData.map((entry, index) => (
                  <tr 
                    key={index} 
                    className={`border-t border-gray-200 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">{formatTime(entry.timestamp)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getActionBadge(entry.action)}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{formatOrderId(entry.order_id)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatAmount(entry.amount_paise)}</td>
                    <td className={`px-4 py-3 text-sm font-medium ${getStatusColor(entry.status)}`}>
                      {entry.status}
                    </td>
                    <td 
                      className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate"
                      title={entry.agent_reasoning || ''}
                    >
                      {truncateReasoning(entry.agent_reasoning)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;