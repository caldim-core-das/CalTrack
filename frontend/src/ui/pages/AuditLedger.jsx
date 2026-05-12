import React from "react"
import { Clock, FileText } from "lucide-react"
import { Pill, formatDateTime } from "../components/kit.jsx"

export default function AuditLedger({ logs, loading, elapsed, downloadLogPdf, submitLog, formatDuration }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="p-6 professional-subtitle text-slate-400">Date</th>
              <th className="p-6 professional-subtitle text-slate-400">Timeline</th>
              <th className="p-6 professional-subtitle text-slate-400">Verification</th>
              <th className="p-6 professional-subtitle text-slate-400">Approval Status</th>
              <th className="p-6 professional-subtitle text-slate-400 text-right">Total Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              [1, 2, 3].map(i => (
                <tr key={i}>
                  <td colSpan={5} className="p-6 animate-pulse">
                    <div className="h-10 bg-slate-100 rounded-lg w-full"></div>
                  </td>
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-20 text-center">
                  <div className="flex flex-col items-center gap-4 text-slate-400">
                    <Clock size={48} className="opacity-10" />
                    <div className="font-bold">No attendance records found</div>
                  </div>
                </td>
              </tr>
            ) : (
              logs.map(l => {
                const isRowActive = !l.clock_out
                const dur = isRowActive ? elapsed : l.worked_seconds
                return (
                  <tr key={l.id} className={`group hover:bg-slate-50/50 transition-colors ${isRowActive ? 'bg-indigo-50/30' : ''}`}>
                    <td className="p-6">
                      <div className="text-sm font-bold text-slate-700">{l.work_date}</div>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase">In</span>
                            <span className="text-sm font-bold text-slate-700">{formatDateTime(l.clock_in).split(",")[1]}</span>
                          </div>
                          {l.clock_out && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase">Out</span>
                              <span className="text-sm font-bold text-slate-700">{formatDateTime(l.clock_out).split(",")[1]}</span>
                            </div>
                          )}
                        </div>
                        {isRowActive && <div className="px-2 py-0.5 bg-indigo-600 text-white text-[9px] font-black rounded-full animate-pulse">LIVE</div>}
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-2">
                        {l.clock_in_photo && (
                          <a href={l.clock_in_photo} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg overflow-hidden border border-slate-100 shadow-sm hover:scale-110 transition-transform">
                            <img src={l.clock_in_photo} className="w-full h-full object-cover" />
                          </a>
                        )}
                        {l.clock_out_photo && (
                          <a href={l.clock_out_photo} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg overflow-hidden border border-slate-100 shadow-sm hover:scale-110 transition-transform">
                            <img src={l.clock_out_photo} className="w-full h-full object-cover" />
                          </a>
                        )}
                        {!l.clock_in_photo && !l.clock_out_photo && <span className="text-[10px] font-bold text-slate-300">N/A</span>}
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        <Pill variant={l.status === 'approved' ? 'success' : l.status === 'rejected' ? 'danger' : l.status === 'submitted' ? 'warning' : 'neutral'}>
                          {l.status === 'submitted' ? 'In Review' : (l.status || (isRowActive ? 'Active' : 'Draft'))}
                        </Pill>
                        {l.status === 'draft' && <button onClick={() => submitLog(l.id)} className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-lg">SUBMIT</button>}
                        {l.clock_out && <button onClick={() => downloadLogPdf(l.id)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"><FileText size={14} /></button>}
                      </div>
                    </td>
                    <td className="p-6 text-right">
                      <div className={`text-sm font-black ${dur > 8 * 3600 ? 'text-red-600' : 'text-slate-900'}`}>
                        {formatDuration(dur)}
                      </div>
                      {dur > 8 * 3600 && <div className="text-[9px] font-black text-red-400 uppercase">OT +{formatDuration(dur - 8 * 3600)}</div>}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
