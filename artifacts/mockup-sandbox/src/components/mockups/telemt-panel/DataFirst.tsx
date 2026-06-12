import React from "react";
import { 
  Shield, Activity, Users, Zap, Server, Settings, 
  Search, Bell, Signal, HardDrive, Cpu, Clock, 
  ChevronDown, Check, Globe, Network, ArrowUpRight, 
  ArrowDownRight, BarChart3, Lock
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../ui/card";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";

export function DataFirst() {
  return (
    <div className="min-h-[100dvh] bg-[#0f1115] text-slate-200 font-sans selection:bg-cyan-500/30 dark">
      {/* Top Bar - Chrome Replacement */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-slate-800 bg-[#0f1115]/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-[#0f1115]/60">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
              <Network className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold tracking-wide text-slate-100">TELEMT</span>
          </div>
          
          <div className="h-4 w-px bg-slate-800"></div>

          {/* Primary Nav: Node Selector */}
          <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-md border border-slate-800">
            <button className="flex items-center gap-2 rounded-sm bg-slate-800 px-3 py-1.5 text-xs font-medium text-white shadow-sm ring-1 ring-slate-700/50">
              <span className="flex h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"></span>
              fra-node-01
            </button>
            <button className="flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
              ams-node-02
            </button>
            <button className="flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors">
              <span className="flex h-2 w-2 rounded-full bg-amber-500"></span>
              hel-node-03
            </button>
            <button className="flex items-center justify-center rounded-sm px-2 py-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors">
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <Check className="h-3.5 w-3.5" />
            Система стабильна
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800">
            <Bell className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] p-4">
        {/* Secondary Nav: Page Context */}
        <div className="mb-6 flex items-center gap-6 border-b border-slate-800/60 pb-4">
          <nav className="flex gap-1">
            <button className="rounded-full bg-cyan-500/10 px-4 py-1.5 text-sm font-medium text-cyan-400 ring-1 ring-cyan-500/20">Дашборд</button>
            <button className="rounded-full px-4 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors">Пользователи</button>
            <button className="rounded-full px-4 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors">Статистика</button>
            <button className="rounded-full px-4 py-1.5 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors">Безопасность</button>
          </nav>
          
          <div className="ml-auto flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Обновлено: только что</span>
            <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> v2.4.1-stable</span>
          </div>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-12 gap-4">
          
          {/* Main Stats Row */}
          <div className="col-span-12 grid grid-cols-4 gap-4">
            <Card className="bg-[#15181e] border-slate-800/60 shadow-sm overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Users className="h-16 w-16" />
              </div>
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-400 font-medium">Активные пользователи</CardDescription>
                <CardTitle className="text-4xl font-light tracking-tight text-white flex items-baseline gap-2">
                  12,482
                  <span className="text-sm font-medium text-emerald-400 flex items-center"><ArrowUpRight className="h-3 w-3 mr-0.5" /> 4.2%</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-full flex items-end gap-1 mt-2">
                  {[40, 55, 45, 60, 50, 70, 65, 80, 75, 85, 80, 95].map((h, i) => (
                    <div key={i} className="bg-cyan-500/20 hover:bg-cyan-400 w-full rounded-t-sm transition-all" style={{ height: `${h}%` }}></div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#15181e] border-slate-800/60 shadow-sm overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Activity className="h-16 w-16" />
              </div>
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-400 font-medium">Соединения (TCP)</CardDescription>
                <CardTitle className="text-4xl font-light tracking-tight text-white flex items-baseline gap-2">
                  48.2k
                  <span className="text-sm font-medium text-slate-500 font-mono">/ 65k MAX</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full bg-slate-800/50 rounded-full h-1.5 mt-6 mb-2 overflow-hidden">
                  <div className="bg-cyan-500 h-1.5 rounded-full" style={{ width: "74%" }}></div>
                </div>
                <div className="flex justify-between text-xs text-slate-500 font-mono">
                  <span>Загрузка 74%</span>
                  <span>Осталось 16.8k</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#15181e] border-slate-800/60 shadow-sm overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Signal className="h-16 w-16" />
              </div>
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-400 font-medium">Трафик (Rx / Tx)</CardDescription>
                <CardTitle className="text-4xl font-light tracking-tight text-white flex items-baseline gap-2">
                  1.2 <span className="text-xl text-slate-400 font-normal">Gbps</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center mt-2 bg-slate-900/50 p-2 rounded border border-slate-800/50">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">Входящий</span>
                    <span className="text-sm font-mono text-emerald-400">450 Mbps</span>
                  </div>
                  <div className="h-6 w-px bg-slate-800"></div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">Исходящий</span>
                    <span className="text-sm font-mono text-cyan-400">750 Mbps</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#15181e] border-slate-800/60 shadow-sm overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Server className="h-16 w-16" />
              </div>
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-400 font-medium">Ресурсы узла</CardDescription>
                <CardTitle className="text-4xl font-light tracking-tight text-white flex items-baseline gap-2">
                  14<span className="text-xl text-slate-400 font-normal">% CPU</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 mt-2">
                  <div className="flex items-center gap-3">
                    <Cpu className="h-4 w-4 text-slate-500" />
                    <div className="flex-1">
                      <div className="w-full bg-slate-800/50 rounded-full h-1">
                        <div className="bg-emerald-500 h-1 rounded-full" style={{ width: "14%" }}></div>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-slate-400 w-8 text-right">14%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <HardDrive className="h-4 w-4 text-slate-500" />
                    <div className="flex-1">
                      <div className="w-full bg-slate-800/50 rounded-full h-1">
                        <div className="bg-amber-500 h-1 rounded-full" style={{ width: "62%" }}></div>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-slate-400 w-8 text-right">62%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upstream Latency Table */}
          <Card className="col-span-8 bg-[#15181e] border-slate-800/60 shadow-sm flex flex-col">
            <CardHeader className="py-4 border-b border-slate-800/60">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-medium text-slate-200">Маршрутизация DC Telegram</CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-1">Задержки и доступность апстримов</CardDescription>
                </div>
                <Badge variant="outline" className="bg-slate-900/50 text-slate-400 border-slate-700">Обновление: 2 сек</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 bg-slate-900/30 uppercase border-b border-slate-800/60">
                  <tr>
                    <th className="px-4 py-3 font-medium">Датацентр</th>
                    <th className="px-4 py-3 font-medium">IP адрес</th>
                    <th className="px-4 py-3 font-medium text-right">Пинг</th>
                    <th className="px-4 py-3 font-medium text-right">Качество</th>
                    <th className="px-4 py-3 font-medium">Состояние</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {[
                    { dc: "DC 1 (Miami)", ip: "149.154.175.50", ping: 112, quality: 85, status: "ok" },
                    { dc: "DC 2 (Amsterdam)", ip: "149.154.167.51", ping: 12, quality: 98, status: "ok" },
                    { dc: "DC 3 (Miami)", ip: "149.154.175.100", ping: 115, quality: 82, status: "ok" },
                    { dc: "DC 4 (Amsterdam)", ip: "149.154.167.91", ping: 14, quality: 97, status: "ok" },
                    { dc: "DC 5 (Singapore)", ip: "91.108.56.130", ping: 156, quality: 65, status: "warn" },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-slate-800/20 transition-colors group">
                      <td className="px-4 py-3 font-medium text-slate-300 flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-slate-500" />
                        {row.dc}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{row.ip}</td>
                      <td className="px-4 py-3 font-mono text-right">
                        <span className={row.ping < 50 ? "text-emerald-400" : row.ping < 120 ? "text-amber-400" : "text-rose-400"}>
                          {row.ping} ms
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-slate-800/50 rounded-full h-1.5 flex justify-end">
                            <div 
                              className={`h-1.5 rounded-full ${row.quality > 90 ? 'bg-emerald-500' : row.quality > 70 ? 'bg-cyan-500' : 'bg-amber-500'}`} 
                              style={{ width: `${row.quality}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {row.status === 'ok' ? (
                          <Badge className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-0 font-normal px-2 py-0 h-5">Active</Badge>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-0 font-normal px-2 py-0 h-5">Degraded</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Active Logs / Connections */}
          <Card className="col-span-4 bg-[#15181e] border-slate-800/60 shadow-sm flex flex-col overflow-hidden">
            <CardHeader className="py-4 border-b border-slate-800/60">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-medium text-slate-200">События сессий</CardTitle>
                </div>
                <div className="flex gap-1">
                  <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 bg-slate-950/30 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#15181e] pointer-events-none z-10"></div>
              <div className="p-4 space-y-3 font-mono text-[11px] leading-relaxed">
                {[
                  { time: "14:23:01", event: "NEW_CONN", ip: "82.14.**.**", tag: "ios_client" },
                  { time: "14:23:01", event: "AUTH_OK", ip: "82.14.**.**", tag: "user_id:9102" },
                  { time: "14:22:58", event: "CONN_DROP", ip: "193.41.**.**", tag: "timeout" },
                  { time: "14:22:55", event: "NEW_CONN", ip: "45.12.**.**", tag: "android_client" },
                  { time: "14:22:55", event: "AUTH_OK", ip: "45.12.**.**", tag: "user_id:4412" },
                  { time: "14:22:41", event: "NEW_CONN", ip: "91.22.**.**", tag: "tdesktop" },
                  { time: "14:22:40", event: "QUOTA_WARN", ip: "185.11.**.**", tag: "limit_reached" },
                  { time: "14:22:38", event: "NEW_CONN", ip: "88.14.**.**", tag: "ios_client" },
                  { time: "14:22:38", event: "AUTH_OK", ip: "88.14.**.**", tag: "user_id:1192" },
                ].map((log, i) => (
                  <div key={i} className="flex gap-3 text-slate-400 opacity-80 hover:opacity-100 transition-opacity">
                    <span className="text-slate-600 select-none">{log.time}</span>
                    <span className={
                      log.event.includes('OK') ? 'text-emerald-400' :
                      log.event.includes('WARN') || log.event.includes('DROP') ? 'text-amber-400' :
                      'text-cyan-400'
                    }>{log.event.padEnd(10, ' ')}</span>
                    <span className="text-slate-300">{log.ip}</span>
                    <span className="text-slate-500">[{log.tag}]</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
