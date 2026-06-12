import React, { useState } from "react";
import { Activity, Server, Shield, Zap, Settings, Users, ArrowRightLeft, Radio, AlertCircle } from "lucide-react";
import "./_group.css";

const NODES = [
  { id: "n1", name: "FRA-01 (Main)", ip: "104.28.12.5", status: "healthy", users: 12450, load: 45, x: 20, y: 25 },
  { id: "n2", name: "AMS-02 (Backup)", ip: "188.166.45.12", status: "degraded", users: 8200, load: 88, x: 20, y: 50 },
  { id: "n3", name: "HEL-01 (Edge)", ip: "135.181.22.9", status: "healthy", users: 3100, load: 15, x: 20, y: 75 },
];

const DCS = [
  { id: "dc1", name: "DC1 (Miami)", x: 80, y: 15 },
  { id: "dc2", name: "DC2 (Amsterdam)", x: 80, y: 32.5 },
  { id: "dc3", name: "DC3 (Miami)", x: 80, y: 50 },
  { id: "dc4", name: "DC4 (Amsterdam)", x: 80, y: 67.5 },
  { id: "dc5", name: "DC5 (Singapore)", x: 80, y: 85 },
];

const CONNECTIONS = [
  // FRA-01
  { source: "n1", target: "dc1", latency: 95, traffic: 1.2, status: "healthy" },
  { source: "n1", target: "dc2", latency: 12, traffic: 4.5, status: "healthy" },
  { source: "n1", target: "dc4", latency: 14, traffic: 2.1, status: "healthy" },
  // AMS-02
  { source: "n2", target: "dc2", latency: 8, traffic: 6.8, status: "degraded" }, // High load
  { source: "n2", target: "dc4", latency: 9, traffic: 5.2, status: "degraded" },
  { source: "n2", target: "dc5", latency: 180, traffic: 0.5, status: "error" }, // Packet loss
  // HEL-01
  { source: "n3", target: "dc2", latency: 25, traffic: 1.1, status: "healthy" },
  { source: "n3", target: "dc4", latency: 28, traffic: 0.8, status: "healthy" },
];

export function NetworkTopology() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy": return "text-emerald-400";
      case "degraded": return "text-amber-400";
      case "error": return "text-rose-400";
      default: return "text-slate-400";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "healthy": return "bg-emerald-400";
      case "degraded": return "bg-amber-400";
      case "error": return "bg-rose-400";
      default: return "bg-slate-400";
    }
  };

  const getStatusBorder = (status: string) => {
    switch (status) {
      case "healthy": return "border-emerald-500/50";
      case "degraded": return "border-amber-500/50";
      case "error": return "border-rose-500/50";
      default: return "border-slate-500/50";
    }
  };

  const getPulseClass = (status: string) => {
    switch (status) {
      case "healthy": return "animate-pulse-green";
      case "degraded": return "animate-pulse-yellow";
      case "error": return "animate-pulse-red";
      default: return "";
    }
  };

  const getStrokeClass = (status: string) => {
    switch (status) {
      case "healthy": return "stroke-emerald-500/50";
      case "degraded": return "stroke-amber-500/70";
      case "error": return "stroke-rose-500/80";
      default: return "stroke-slate-500/50";
    }
  };

  const getAnimClass = (traffic: number) => {
    if (traffic > 5) return "animate-dash-flow-fast";
    if (traffic < 1) return "animate-dash-flow-slow";
    return "animate-dash-flow";
  };

  return (
    <div className="flex h-screen w-full bg-[#0a0f1a] text-slate-300 font-sans overflow-hidden">
      {/* Sidebar Rail */}
      <div className="w-16 flex-shrink-0 bg-slate-950/80 border-r border-slate-800/50 flex flex-col items-center py-6 z-20 backdrop-blur-xl">
        <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center mb-8 border border-indigo-500/30">
          <Zap className="w-5 h-5 text-indigo-400" />
        </div>
        
        <div className="flex flex-col gap-6 w-full items-center">
          <button className="p-3 rounded-xl bg-slate-800/50 text-indigo-400 border border-slate-700/50">
            <Activity className="w-5 h-5" />
          </button>
          <button className="p-3 rounded-xl text-slate-500 hover:text-slate-300 transition-colors">
            <Server className="w-5 h-5" />
          </button>
          <button className="p-3 rounded-xl text-slate-500 hover:text-slate-300 transition-colors">
            <Users className="w-5 h-5" />
          </button>
          <button className="p-3 rounded-xl text-slate-500 hover:text-slate-300 transition-colors">
            <Shield className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-auto">
          <button className="p-3 rounded-xl text-slate-500 hover:text-slate-300 transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 relative flex flex-col bg-grid-slate-900">
        
        {/* Top Bar Metrics */}
        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-[#0a0f1a] to-transparent z-10 flex items-center px-8 justify-between">
          <div>
            <h1 className="text-xl font-medium text-white tracking-wide">Топология сети</h1>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-mono">Telemt Core // Live Traffic</p>
          </div>

          <div className="flex gap-8">
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 uppercase font-mono tracking-wider">Total Active</span>
              <span className="text-2xl font-light text-white">23,750 <span className="text-sm text-slate-500">usr</span></span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 uppercase font-mono tracking-wider">Global Throughput</span>
              <span className="text-2xl font-light text-emerald-400">18.4 <span className="text-sm text-slate-500">Gbps</span></span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 uppercase font-mono tracking-wider">Network Health</span>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-sm text-amber-400 font-medium">Degraded (AMS)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Topology Map */}
        <div className="flex-1 relative w-full h-full">
          
          {/* Connections (SVG) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
            {CONNECTIONS.map((conn, i) => {
              const source = NODES.find(n => n.id === conn.source)!;
              const target = DCS.find(d => d.id === conn.target)!;
              
              const isFaded = selectedNode && selectedNode !== source.id;
              
              // Curve calculation
              const sx = `calc(${source.x}% + 3rem)`;
              const sy = `${source.y}%`;
              const tx = `calc(${target.x}% - 3rem)`;
              const ty = `${target.y}%`;

              return (
                <g key={i} className={`transition-opacity duration-500 ${isFaded ? 'opacity-10' : 'opacity-100'}`}>
                  {/* Base line */}
                  <path
                    d={`M ${source.x} ${source.y} C 50 ${source.y}, 50 ${target.y}, ${target.x} ${target.y}`}
                    className={`fill-none stroke-[2px] transition-colors ${getStrokeClass(conn.status)}`}
                    vectorEffect="non-scaling-stroke"
                    style={{
                      d: `path("M ${source.x} ${source.y} C 50 ${source.y}, 50 ${target.y}, ${target.x} ${target.y}")` // SVG doesn't use CSS calc well in path without some trickery, so we'll rely on relative viewBox if we could, but here we can't easily. Wait, we can use percentage in SVG? No, SVG paths need absolute coords or we use viewBox.
                    }}
                  />
                  {/* To fix the SVG path with percentages, it's better to use a viewBox of 100x100 and preserveAspectRatio="none" */}
                </g>
              );
            })}
          </svg>

          {/* Actual SVG overlay with 100 100 viewBox to use percentage paths directly */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
             {CONNECTIONS.map((conn, i) => {
              const source = NODES.find(n => n.id === conn.source)!;
              const target = DCS.find(d => d.id === conn.target)!;
              const isFaded = selectedNode && selectedNode !== source.id;
              
              const strokeW = Math.max(0.5, conn.traffic * 0.3);

              return (
                <g key={i} className={`transition-opacity duration-500 ${isFaded ? 'opacity-10' : 'opacity-100'}`}>
                  {/* Glow/Base */}
                  <path
                    d={`M ${source.x} ${source.y} C 50 ${source.y}, 50 ${target.y}, ${target.x} ${target.y}`}
                    className={`fill-none transition-colors ${getStrokeClass(conn.status)} opacity-30`}
                    strokeWidth={strokeW + 1}
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* Animated Dashes */}
                  <path
                    d={`M ${source.x} ${source.y} C 50 ${source.y}, 50 ${target.y}, ${target.x} ${target.y}`}
                    className={`fill-none transition-colors ${getStrokeClass(conn.status)} ${getAnimClass(conn.traffic)}`}
                    strokeWidth={strokeW}
                    strokeDasharray="4 6"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
          </svg>

          {/* Nodes */}
          {NODES.map(node => (
            <div
              key={node.id}
              onClick={() => setSelectedNode(node.id === selectedNode ? null : node.id)}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer transition-all duration-300 z-10
                ${selectedNode && selectedNode !== node.id ? 'opacity-30 scale-95' : 'opacity-100 scale-100'}`}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
            >
              <div className="mb-3 flex flex-col items-center">
                <span className="text-white font-medium tracking-wide bg-slate-900/80 px-2 py-1 rounded backdrop-blur-md border border-slate-700/50">{node.name}</span>
                <span className="text-xs text-slate-500 font-mono mt-1">{node.ip}</span>
              </div>
              
              <div className={`w-14 h-14 rounded-full bg-slate-900 border-2 ${getStatusBorder(node.status)} flex items-center justify-center relative ${getPulseClass(node.status)}`}>
                <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/10 to-transparent" />
                <Server className={`w-6 h-6 ${getStatusColor(node.status)} relative z-10`} />
                
                {/* Status indicator pip */}
                <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full ${getStatusBg(node.status)} border-2 border-slate-900`} />
              </div>

              {/* Node Stats Tooltip-ish */}
              <div className="mt-4 bg-slate-900/90 border border-slate-700/50 rounded-lg p-2 text-xs flex gap-4 backdrop-blur-md">
                <div className="flex flex-col items-center">
                  <span className="text-slate-500 mb-1">Load</span>
                  <span className={`font-mono ${node.load > 80 ? 'text-rose-400' : 'text-emerald-400'}`}>{node.load}%</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-slate-500 mb-1">Users</span>
                  <span className="font-mono text-white">{(node.users / 1000).toFixed(1)}k</span>
                </div>
              </div>
            </div>
          ))}

          {/* Telegram DCs */}
          {DCS.map(dc => (
            <div
              key={dc.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-row items-center z-10"
              style={{ left: `${dc.x}%`, top: `${dc.y}%` }}
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center relative backdrop-blur-sm">
                <ArrowRightLeft className="w-5 h-5 text-blue-400" />
              </div>
              <div className="ml-4 flex flex-col">
                <span className="text-blue-100 font-medium whitespace-nowrap">{dc.name}</span>
                <span className="text-xs text-blue-400/60 font-mono">TG Core Network</span>
              </div>
            </div>
          ))}

        </div>

        {/* Right Info Panel (Appears when node selected) */}
        {selectedNode && (
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-slate-950/95 border-l border-slate-800/50 shadow-2xl backdrop-blur-xl p-6 transform transition-transform duration-300 z-20 overflow-y-auto">
            {(() => {
              const node = NODES.find(n => n.id === selectedNode)!;
              const conns = CONNECTIONS.filter(c => c.source === selectedNode);
              return (
                <div className="flex flex-col h-full animate-in slide-in-from-right-8 fade-in">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h2 className="text-xl font-bold text-white">{node.name}</h2>
                      <p className="text-sm text-slate-400 font-mono mt-1">{node.ip}</p>
                    </div>
                    <button 
                      onClick={() => setSelectedNode(null)}
                      className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                    >
                      &times;
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-slate-900 rounded-lg p-3 border border-slate-800">
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">CPU Load</p>
                      <p className={`text-xl font-mono ${node.load > 80 ? 'text-rose-400' : 'text-emerald-400'}`}>{node.load}%</p>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-3 border border-slate-800">
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Users</p>
                      <p className="text-xl font-mono text-white">{node.users}</p>
                    </div>
                  </div>

                  <h3 className="text-sm font-medium text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-slate-500" />
                    Upstream Links
                  </h3>
                  
                  <div className="flex flex-col gap-3">
                    {conns.map(conn => {
                      const dc = DCS.find(d => d.id === conn.target)!;
                      return (
                        <div key={conn.target} className="bg-slate-900/50 rounded-lg p-4 border border-slate-800/50 relative overflow-hidden">
                          <div className={`absolute top-0 left-0 w-1 h-full ${getStatusBg(conn.status)}`} />
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-slate-200">{dc.name}</span>
                            {conn.status === "error" && <AlertCircle className="w-4 h-4 text-rose-400" />}
                          </div>
                          <div className="flex justify-between text-xs font-mono">
                            <span className="text-slate-400">Latency: <span className={getStatusColor(conn.status)}>{conn.latency}ms</span></span>
                            <span className="text-slate-400">Tx: <span className="text-white">{conn.traffic} Gbps</span></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-auto pt-6">
                    <button className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium text-sm">
                      Configure Routing
                    </button>
                    <button className="w-full py-2 mt-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors font-medium text-sm border border-rose-500/20">
                      Restart Proxy Service
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

      </div>
    </div>
  );
}
