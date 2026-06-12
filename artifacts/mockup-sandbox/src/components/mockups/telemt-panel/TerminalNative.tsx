import React, { useState, useEffect } from 'react';

const mockNodes = [
  { id: 'ru-msk-01', status: 'online', users: 12450, load: '45%', uptime: '14d 05h' },
  { id: 'ru-spb-02', status: 'online', users: 8320, load: '32%', uptime: '45d 12h' },
  { id: 'nl-ams-01', status: 'warning', users: 24500, load: '89%', uptime: '120d 01h' },
  { id: 'de-fra-03', status: 'offline', users: 0, load: '0%', uptime: '0d 00h' },
  { id: 'uk-lon-01', status: 'online', users: 4100, load: '15%', uptime: '5d 22h' },
  { id: 'fi-hel-02', status: 'online', users: 6700, load: '22%', uptime: '18d 14h' },
];

const mockLatency = [
  { dc: 'DC1 (Miami)', ms: 145, status: 'ok' },
  { dc: 'DC2 (Amsterdam)', ms: 12, status: 'ok' },
  { dc: 'DC3 (Miami)', ms: 150, status: 'warning' },
  { dc: 'DC4 (Amsterdam)', ms: 14, status: 'ok' },
  { dc: 'DC5 (Singapore)', ms: 240, status: 'critical' },
];

const mockLogs = [
  "[10:45:32] INFO: Node ru-msk-01 synchronized",
  "[10:44:12] WARN: nl-ams-01 load exceeding 85%",
  "[10:42:05] ERROR: Connection refused to de-fra-03",
  "[10:40:11] INFO: DC2 routing table updated",
  "[10:35:00] INFO: Daily traffic quota reset",
  "[10:30:45] INFO: New version 2.4.1 available",
  "[10:25:12] WARN: High latency detected on DC5",
  "[10:20:01] INFO: Sysadmin login from 192.168.1.42",
];

const getStatusSymbol = (status: string) => {
  switch (status) {
    case 'online': return '●';
    case 'offline': return '○';
    case 'warning': return '▲';
    case 'critical': return '■';
    default: return '○';
  }
};

const getStatusClass = (status: string) => {
  switch (status) {
    case 'online': return 'text-[#00ff41]';
    case 'offline': return 'text-red-500';
    case 'warning': return 'text-yellow-400';
    case 'critical': return 'text-red-600 bg-red-900/50';
    default: return 'text-gray-500';
  }
};

export function TerminalNative() {
  const [time, setTime] = useState(new Date().toLocaleTimeString('ru-RU'));
  const [activeTab, setActiveTab] = useState('dashboard');
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString('ru-RU')), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-black text-[#00ff41] p-4 flex flex-col font-mono text-sm sm:text-base relative overflow-hidden" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
        
        .scanlines::before {
          content: " ";
          display: block;
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          right: 0;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
          z-index: 50;
          background-size: 100% 2px, 3px 100%;
          pointer-events: none;
        }
        
        .border-ascii {
          border: 1px solid #00ff41;
        }
        
        .border-ascii-b {
          border-bottom: 1px solid #00ff41;
        }

        .border-ascii-r {
          border-right: 1px solid #00ff41;
        }
        
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #000; 
          border-left: 1px solid #00ff41;
        }
        ::-webkit-scrollbar-thumb {
          background: #00ff41; 
        }
      `}</style>
      
      <div className="scanlines"></div>

      {/* Header Tabs */}
      <div className="flex border-ascii-b mb-4 flex-wrap z-10 relative">
        <div className="px-4 py-1 border-ascii-r font-bold bg-[#00ff41] text-black">
          root@telemt:~#
        </div>
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-1 border-ascii-r hover:bg-[#003311] transition-colors ${activeTab === 'dashboard' ? 'bg-[#002200]' : ''}`}
        >
          [1] ДАШБОРД
        </button>
        <button 
          onClick={() => setActiveTab('nodes')}
          className={`px-4 py-1 border-ascii-r hover:bg-[#003311] transition-colors ${activeTab === 'nodes' ? 'bg-[#002200]' : ''}`}
        >
          [2] УЗЛЫ
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-1 border-ascii-r hover:bg-[#003311] transition-colors ${activeTab === 'settings' ? 'bg-[#002200]' : ''}`}
        >
          [3] КОНФИГ
        </button>
        <div className="ml-auto px-4 py-1">
          {time} | UPTIME: 342d 12h
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 z-10 relative">
        
        {/* Left Column: Nodes & Logs */}
        <div className="md:col-span-8 flex flex-col gap-4">
          
          {/* Nodes Pane */}
          <div className="border-ascii flex-1 flex flex-col min-h-[300px]">
            <div className="border-ascii-b px-2 py-1 bg-[#002200] font-bold">
              +-- СТАТУС УЗЛОВ (NODES) ------------------------------------------------+
            </div>
            <div className="p-2 overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-ascii-b text-[#00cc33]">
                    <th className="py-2 px-2 font-normal">ID УЗЛА</th>
                    <th className="py-2 px-2 font-normal">СТАТУС</th>
                    <th className="py-2 px-2 font-normal">ПОЛЬЗ-ЛИ</th>
                    <th className="py-2 px-2 font-normal">НАГРУЗКА</th>
                    <th className="py-2 px-2 font-normal">АПТАЙМ</th>
                  </tr>
                </thead>
                <tbody>
                  {mockNodes.map(node => (
                    <tr key={node.id} className="hover:bg-[#002200] border-b border-[#003311]">
                      <td className="py-2 px-2">{node.id}</td>
                      <td className={`py-2 px-2 ${getStatusClass(node.status)}`}>
                        {getStatusSymbol(node.status)} {node.status.toUpperCase()}
                      </td>
                      <td className="py-2 px-2">{node.users.toLocaleString('ru-RU')}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <span className="w-8 inline-block">{node.load}</span>
                          <span className="text-xs">
                            [{'#'.repeat(Math.round(parseInt(node.load)/10)).padEnd(10, '-')}]
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-2">{node.uptime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Logs Pane */}
          <div className="border-ascii h-48 flex flex-col">
            <div className="border-ascii-b px-2 py-1 bg-[#002200] font-bold">
              +-- ЖУРНАЛ СОБЫТИЙ (SYSLOG) ---------------------------------------------+
            </div>
            <div className="p-2 overflow-y-auto flex-1 text-xs">
              {mockLogs.map((log, i) => (
                <div key={i} className={`mb-1 ${log.includes('ERROR') ? 'text-red-500' : log.includes('WARN') ? 'text-yellow-400' : 'text-[#00cc33]'}`}>
                  {log}
                </div>
              ))}
              <div className="mt-2 text-[#00ff41] animate-pulse">_</div>
            </div>
          </div>
          
        </div>

        {/* Right Column: Traffic & Latency */}
        <div className="md:col-span-4 flex flex-col gap-4">
          
          {/* Traffic Pane */}
          <div className="border-ascii flex-none">
            <div className="border-ascii-b px-2 py-1 bg-[#002200] font-bold">
              +-- СТАТИСТИКА (TRAFFIC) ----+
            </div>
            <div className="p-4 flex flex-col gap-4">
              <div>
                <div className="text-[#00cc33] text-xs mb-1">АКТИВНЫЕ СОЕДИНЕНИЯ</div>
                <div className="text-3xl font-bold">56,070</div>
              </div>
              <div>
                <div className="text-[#00cc33] text-xs mb-1">RX (ВХОДЯЩИЙ)</div>
                <div className="text-xl">4.2 TB / мес</div>
              </div>
              <div>
                <div className="text-[#00cc33] text-xs mb-1">TX (ИСХОДЯЩИЙ)</div>
                <div className="text-xl">18.7 TB / мес</div>
              </div>
              <div className="pt-2 border-t border-dashed border-[#00ff41]">
                <div className="text-[#00cc33] text-xs mb-1">ТЕКУЩАЯ ПРОПУСКНАЯ СПОСОБНОСТЬ</div>
                <div className="text-lg">842.5 Mbps</div>
              </div>
            </div>
          </div>

          {/* Latency Pane */}
          <div className="border-ascii flex-1 flex flex-col">
            <div className="border-ascii-b px-2 py-1 bg-[#002200] font-bold">
              +-- ПИНГ DC (LATENCY) -------+
            </div>
            <div className="p-2 overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <tbody>
                  {mockLatency.map((lat, i) => (
                    <tr key={i} className="border-b border-dashed border-[#003311]">
                      <td className="py-2 px-1">{lat.dc}</td>
                      <td className={`py-2 px-1 text-right ${lat.status === 'warning' ? 'text-yellow-400' : lat.status === 'critical' ? 'text-red-500' : ''}`}>
                        {lat.ms}ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
      
      {/* Footer Info */}
      <div className="mt-4 text-xs text-[#00cc33] flex justify-between z-10 relative">
        <span>Telemt Proxy Admin Panel v2.4.0</span>
        <span>Type 'help' for available commands</span>
      </div>
    </div>
  );
}
