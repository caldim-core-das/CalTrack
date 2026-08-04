import fs from 'fs';

const filepath = 'c:/Users/user/Caltrackk/Caltrack/frontend/src/ui/pages/BookingPage.jsx';
let content = fs.readFileSync(filepath, 'utf8');

const startStr = 'function LiveTrackingPage({';
const endStr = 'const STEP_LABELS = ["Service", "Package", "Schedule", "Identity", "Details", "Confirm"]';

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  const newCode = `function LiveTrackingPage({ successData, technician, category, cart, formData, selDate, selTime, onBookAgain }) {
  const rid = successData?.request_id || successData?.id || "BK" + Date.now().toString().slice(-6)
  const [etaMinutes, setEtaMinutes] = useState(25)
  const totalPrice = cart ? cart.reduce((a, c) => a + (c.price * c.quantity), 0) : (successData?.estimated_cost || 0)
  const displayDate = selDate ? new Date(selDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : (successData?.scheduled_date || "Today")
  const displayTime = selTime ? LOCAL_TIME_SLOTS.flatMap(g => g.slots).find(s => s.t === selTime)?.l : (successData?.time_slot || "Upcoming")

  const tech = technician || successData?.technician || null

  const trackSteps = [
    { label: "Booking Confirmed", icon: <CheckCircle2 size={16} color="#10B981" />, done: true, time: "Just now" },
    { label: "Expert Assigned", icon: <User size={16} color="#7C3AED" />, done: !!tech, time: tech ? "Assigned" : "Pending" },
    { label: "Expert On The Way", icon: <MapPin size={16} color="#64748b" />, done: false, time: "Pending" },
    { label: "Service In Progress", icon: <Clock size={16} color="#64748b" />, done: false, time: "Scheduled" },
    { label: "Service Completed", icon: <Award size={16} color="#64748b" />, done: false, time: "Pending" },
  ]

  useEffect(() => {
    if (etaMinutes <= 0) return
    const t = setInterval(() => setEtaMinutes(m => m > 0 ? m - 1 : 0), 60000)
    return () => clearInterval(t)
  }, [etaMinutes])

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 640, margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }}
          style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#7C3AED,#10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}
        >
          <CheckCircle2 size={44} color="white" />
        </motion.div>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.6rem', fontWeight: 900, color: '#0f172a' }}>Booking Confirmed! 🎉</h2>
        <p style={{ margin: '0 0 0.5rem', color: '#64748b', fontSize: '0.9rem' }}>{tech ? \`\${tech.name} has been assigned\` : "Your request is registered & being assigned"}</p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#f5f3ff', border: '1px solid #7C3AED30', borderRadius: 99, padding: '6px 16px' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase' }}>Booking Ref</span>
          <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>#{rid}</span>
        </div>
      </div>

      {/* Technician Info or Assignment in Progress Card */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        style={{ background: 'white', borderRadius: 20, padding: '1.25rem', marginBottom: '1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}
      >
        {tech ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ position: 'relative' }}>
                <img src={tech.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face"} alt={tech.name} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '3px solid #7C3AED30' }} />
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: '50%', background: '#10B981', border: '2px solid white' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, color: '#0f172a', fontSize: '1.05rem' }}>{tech.name}</div>
                {tech.rating && <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 2 }}>⭐  {tech.rating} · {tech.jobs || '50+'} jobs completed</div>}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <span style={{ background: '#10B98112', color: '#10B981', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 99, border: '1px solid #10B98125' }}>Verified Pro</span>
                  <span style={{ background: '#7C3AED12', color: '#7C3AED', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 99, border: '1px solid #7C3AED25' }}>Background Checked</span>
                </div>
              </div>
              <div style={{ textAlign: 'center', background: 'linear-gradient(135deg,#F59E0B,#FBBF24)', borderRadius: 12, padding: '0.6rem 1rem', color: 'white' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>{etaMinutes}</div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700 }}>MIN ETA</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button onClick={() => alert(\`Calling \${tech.name}...\`)}
                style={{ flex: 1, padding: '0.7rem', background: '#7C3AED', color: 'white', fontWeight: 700, fontSize: '0.85rem', border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Phone size={15} /> Call Expert
              </button>
              <button onClick={() => alert("Chat feature coming soon!")}
                style={{ flex: 1, padding: '0.7rem', background: '#f1f5f9', color: '#0f172a', fontWeight: 700, fontSize: '0.85rem', border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <MessageSquare size={15} /> Chat
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '0.35rem 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#7C3AED12', border: '1.5px solid #7C3AED25', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <RefreshCw size={26} color="#7C3AED" className="spin-icon" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 900, color: '#0f172a', fontSize: '1rem' }}>Matching Expert</span>
                <span style={{ background: '#7C3AED15', color: '#7C3AED', fontSize: '0.65rem', fontWeight: 800, padding: '2px 9px', borderRadius: 99, border: '1px solid #7C3AED30' }}>
                  Assignment Pending
                </span>
              </div>
              <div style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.45 }}>
                Admin is finding the best verified technician in your area. You will receive notification details shortly.
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Booking Details Card */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        style={{ background: 'white', borderRadius: 20, padding: '1.25rem', marginBottom: '1rem', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}
      >
        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={16} color="#7C3AED" /> Booking Details
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', fontSize: '0.8rem' }}>
          {[
            { label: 'Service', value: category?.name || cart?.[0]?.name },
            { label: 'Date', value: displayDate },
            { label: 'Time', value: displayTime },
            { label: 'Address', value: formData?.address || formData?.location, span: true },
            { label: 'Total Amount', value: \`\${BOOKING_CURRENCY_SYMBOL}\${totalPrice}\`, highlight: true },
          ].map((r, i) => (
            <div key={i} style={{ ...(r.span ? { gridColumn: '1/-1' } : {}), background: '#f8fafc', borderRadius: 10, padding: '0.5rem 0.75rem' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>{r.label}</div>
              <div style={{ fontWeight: 700, color: r.highlight ? '#7C3AED' : '#0f172a', marginTop: 2 }}>{r.value || '—'}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Live Tracking Timeline Card */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        style={{ background: 'white', borderRadius: 20, padding: '1.25rem', marginBottom: '1.5rem', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}
      >
        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={16} color="#7C3AED" /> Live Tracking
        </div>
        {trackSteps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.5rem 0', position: 'relative' }}>
            {i < trackSteps.length - 1 && <div style={{ position: 'absolute', left: 18, top: 36, width: 2, height: 24, background: s.done ? '#10B981' : '#e2e8f0' }} />}
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: s.done ? '#10B98115' : '#f8fafc', border: \`2px solid \${s.done ? '#10B981' : '#e2e8f0'}\`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1rem' }}>
              {s.done ? <Check size={16} color="#10B981" /> : s.icon}
            </div>
            <div style={{ flex: 1, paddingTop: 6 }}>
              <div style={{ fontWeight: 700, color: s.done ? '#0f172a' : '#94a3b8', fontSize: '0.85rem' }}>{s.label}</div>
            </div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: s.done ? '#10B981' : '#94a3b8', paddingTop: 8 }}>{s.time}</div>
          </div>
        ))}
      </motion.div>

      <button onClick={onBookAgain}
        style={{ width: '100%', padding: '1rem', background: '#f1f5f9', color: '#0f172a', fontWeight: 700, fontSize: '0.9rem', border: 'none', borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Home size={16} /> Book Another Service
      </button>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────
   STEP INDICATOR BAR
   ───────────────────────────────────────────────────────────────────────── */

`;

  content = content.slice(0, startIndex) + newCode + content.slice(endIndex);
  fs.writeFileSync(filepath, content, 'utf8');
  console.log('Successfully cleaned LiveTrackingPage!');
} else {
  console.error('Could not locate start or end indices!');
}
