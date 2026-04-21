import { useEffect, useMemo, useState } from "react"

import { apiRequest } from "../../api/client.js"
import { useAuth } from "../../state/auth/useAuth.js"
import { Button, Card, Input, Pill } from "../components/kit.jsx"

function isoDate(d) {
  const pad = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function ReportsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 30)
    return { start: isoDate(start), end: isoDate(end) }
  })
  const [data, setData] = useState(null)

  const summary = useMemo(() => {
    if (!data) return []
    return [
      { label: "Employees (total)", value: data.employees?.total },
      { label: "Employees (active)", value: data.employees?.active },
      { label: "Leaves pending", value: data.leaves?.pending },
      { label: "Leaves approved (range)", value: data.leaves?.approved_in_range },
      { label: "Time logs (range)", value: data.time_tracking?.time_logs_in_range },
      { label: "Payroll runs (range)", value: data.payroll?.records_generated_in_range }
    ]
  }, [data])

  async function load(nextRange = range) {
    setLoading(true)
    setError("")
    try {
      const res = await apiRequest(`/reports/overview/?start=${encodeURIComponent(nextRange.start)}&end=${encodeURIComponent(nextRange.end)}`)
      setData(res)
    } catch (err) {
      setError(err?.body?.detail || "Failed to load reports.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="stackLg">
        <div className="pageHeader">
          <div>
            <h1 className="pageTitle">Reports</h1>
            <div className="pageSub">Admin access required.</div>
          </div>
        </div>
        <Card>
          <div className="muted">You don’t have permission to view this page.</div>
        </Card>
      </div>
    )
  }

  return (
    <div className="stackLg">
      <div className="pageHeader">
        <div>
          <h1 className="pageTitle">Reports</h1>
          <div className="pageSub">A clean overview for decision-making.</div>
        </div>
        <div className="row">
          {data?.range?.start && data?.range?.end ? <Pill tone="neutral">{data.range.start} → {data.range.end}</Pill> : null}
        </div>
      </div>

      {error ? <div className="errorBox">{error}</div> : null}

      <Card
        title="Range"
        actions={
          <Button variant="ghost" type="button" onClick={() => load(range)} disabled={loading}>
            Refresh
          </Button>
        }
      >
        <div className="grid2Tight">
          <Input label="Start" type="date" value={range.start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} />
          <Input label="End" type="date" value={range.end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} />
        </div>
      </Card>

      <div className="grid3">
        {loading ? (
          <Card title="Loading">
            <div className="muted">Fetching metrics…</div>
          </Card>
        ) : (
          summary.map((s) => (
            <Card key={s.label} title={s.label}>
              <div className="metric">
                <div className="metricValue">{s.value ?? "—"}</div>
                <div className="metricLabel">QuickTIMS signal</div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

