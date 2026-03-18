import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri'];
const TIME_SLOTS = ['8:00','8:50','9:45','10:40','11:35','12:30','1:15','2:10','3:05','4:00'];

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('attendance');

  useEffect(() => {
    const stored = sessionStorage.getItem('academia_data');
    if (!stored) { router.push('/'); return; }
    setData(JSON.parse(stored));
  }, []);

  const logout = () => { localStorage.clear(); sessionStorage.clear(); router.push('/'); };

  if (!data) return (
    <div style={{ minHeight:'100vh', background:'#0a0a0f', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:32, height:32, border:'3px solid rgba(99,102,241,0.2)', borderTopColor:'#6366f1', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const user = data?.user || {};
  const attendance = data?.attendance?.attendance || [];
  const marks = data?.marks?.marks || [];
  const timetable = data?.timetable?.schedule || [];
  const courses = data?.courses?.courses || [];

  const avgAtt = attendance.length
    ? (attendance.reduce((s,a) => s + parseFloat(a.attendancePercentage), 0) / attendance.length).toFixed(1)
    : '—';

  const below75 = attendance.filter(a => parseFloat(a.attendancePercentage) < 75).length;

  return (
    <>
      <Head><title>CampusPro — {user.name}</title></Head>
      <div className="app">

        {/* ── SIDEBAR ── */}
        <aside className="sidebar">
          <div className="brand">⬡ CAMPUS<strong>PRO</strong></div>

          <div className="user-box">
            <div className="avatar">{user.name?.[0] || 'S'}</div>
            <div>
              <div className="uname">{user.name}</div>
              <div className="ureg">{user.regNumber}</div>
              <div className="udept">{user.department?.replace(/\(.*\)/,'').trim()}</div>
            </div>
          </div>

          <div className="stats-mini">
            <div className="sm"><div className="sm-v">{user.semester}</div><div className="sm-l">Semester</div></div>
            <div className="sm"><div className="sm-v" style={{color: below75>0?'#ef4444':'#10b981'}}>{below75}</div><div className="sm-l">Below 75%</div></div>
            <div className="sm"><div className="sm-v">{avgAtt}%</div><div className="sm-l">Avg Att.</div></div>
          </div>

          <nav>
            {[
              {id:'attendance', icon:'📊', label:'Attendance'},
              {id:'marks',      icon:'📝', label:'Marks'},
              {id:'timetable',  icon:'🗓',  label:'Timetable'},
              {id:'courses',    icon:'📚', label:'Courses'},
            ].map(n => (
              <button key={n.id} className={`nb ${tab===n.id?'nba':''}`} onClick={() => setTab(n.id)}>
                <span>{n.icon}</span>{n.label}
              </button>
            ))}
          </nav>

          <button className="logout" onClick={logout}>↩ Sign out</button>
        </aside>

        {/* ── MAIN ── */}
        <main className="main">

          {/* ATTENDANCE */}
          {tab === 'attendance' && (
            <div>
              <h2 className="title">Attendance</h2>
              <div className="cards">
                {[
                  {label:'Average',  val: avgAtt+'%',   color:'#a5b4fc'},
                  {label:'Safe ≥75%',val: attendance.filter(a=>parseFloat(a.attendancePercentage)>=75).length, color:'#6ee7b7'},
                  {label:'Danger',   val: below75,       color:'#fca5a5'},
                  {label:'Subjects', val: attendance.length, color:'#fde68a'},
                ].map((c,i) => (
                  <div key={i} className="card">
                    <div className="card-v" style={{color:c.color}}>{c.val}</div>
                    <div className="card-l">{c.label}</div>
                  </div>
                ))}
              </div>
              <div className="att-list">
                {attendance.map((a,i) => {
                  const pct = parseFloat(a.attendancePercentage);
                  const clr = pct>=85?'#10b981':pct>=75?'#f59e0b':'#ef4444';
                  const attended = parseFloat(a.hoursConducted) - parseFloat(a.hoursAbsent);
                  const canMiss = Math.floor(attended - 0.75 * parseFloat(a.hoursConducted));
                  return (
                    <div key={i} className="att-row">
                      <div className="att-info">
                        <div className="att-name">{a.courseTitle}</div>
                        <div className="att-meta">{a.courseCode} · {a.category} · {a.facultyName?.split('(')[0]}</div>
                        <div className="bar-bg"><div className="bar-fill" style={{width:`${Math.min(pct,100)}%`,background:clr}}/></div>
                      </div>
                      <div className="att-right">
                        <div className="att-pct" style={{color:clr}}>{a.attendancePercentage}%</div>
                        <div className="att-hours">{attended}/{a.hoursConducted} hrs</div>
                        <div className="att-margin" style={{color:canMiss>=0?'#6ee7b7':'#fca5a5', background:canMiss>=0?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.1)'}}>
                          {canMiss>=0 ? `Miss ${canMiss} more` : `Need ${Math.abs(canMiss)} more`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MARKS */}
          {tab === 'marks' && (
            <div>
              <h2 className="title">Marks</h2>
              <div className="marks-grid">
                {marks.map((m,i) => {
                  const sc = parseFloat(m.overall?.scored)||0;
                  const tot = parseFloat(m.overall?.total)||0;
                  const pct = tot>0 ? (sc/tot*100) : 0;
                  const clr = pct>=80?'#10b981':pct>=60?'#f59e0b':'#ef4444';
                  return (
                    <div key={i} className="mark-card">
                      <div className="mk-top">
                        <div>
                          <div className="mk-code">{m.courseCode}</div>
                          <div className="mk-name">{m.courseName}</div>
                        </div>
                        <span className={`badge ${m.courseType==='Theory'?'bt':'bp'}`}>{m.courseType}</span>
                      </div>
                      <div className="mk-score" style={{color:clr}}>{m.overall?.scored} <span className="mk-tot">/ {m.overall?.total}</span></div>
                      <div className="bar-bg"><div className="bar-fill" style={{width:`${pct}%`,background:clr}}/></div>
                      {m.testPerformance?.length > 0 && (
                        <div className="tests">
                          {m.testPerformance.map((t,j) => {
                            const mk = typeof t.marks === 'object' ? t.marks : {};
                            return (
                              <div key={j} className="test-row">
                                <span>{t.test}</span>
                                <span>{mk.scored} / {mk.total}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TIMETABLE */}
          {tab === 'timetable' && (
            <div>
              <h2 className="title">Timetable</h2>
              <div className="tt-scroll">
                <table className="tt">
                  <thead>
                    <tr>
                      <th className="tt-day-h"></th>
                      {TIME_SLOTS.map((s,i) => <th key={i}>{s}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {timetable.map((d,di) => (
                      <tr key={di}>
                        <td className="tt-day">{DAY_NAMES[d.day-1]}</td>
                        {(d.table||[]).map((slot,si) => (
                          <td key={si} className="tt-cell">
                            {slot && (
                              <div className={`slot ${slot.courseType==='Practical'?'sp':'st'}`}>
                                <div className="slot-c">{slot.code}</div>
                                <div className="slot-r">{slot.roomNo}</div>
                              </div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* COURSES */}
          {tab === 'courses' && (
            <div>
              <h2 className="title">Courses</h2>
              <div className="courses-grid">
                {courses.map((c,i) => (
                  <div key={i} className="course-card">
                    <div className="cc-top">
                      <span className="cc-code">{c.code}</span>
                      <span className={`badge ${c.slotType==='Theory'?'bt':'bp'}`}>{c.slotType}</span>
                    </div>
                    <div className="cc-title">{c.title}</div>
                    <div className="cc-meta">
                      <div>👤 {c.faculty?.split('(')[0]?.trim()}</div>
                      <div>🏫 {c.room} &nbsp;·&nbsp; 🕐 Slot {c.slot} &nbsp;·&nbsp; ⭐ {c.credit} cr</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>

      <style jsx global>{`* { box-sizing:border-box; margin:0; padding:0; } body { background:#0a0a0f; color:#e2e8f0; }`}</style>
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap');
        .app { display:flex; min-height:100vh; font-family:'DM Sans',sans-serif; }

        /* SIDEBAR */
        .sidebar { width:230px; min-height:100vh; background:rgba(255,255,255,0.02); border-right:1px solid rgba(255,255,255,0.06); padding:24px 16px; display:flex; flex-direction:column; gap:20px; position:sticky; top:0; height:100vh; overflow-y:auto; }
        .brand { font-family:'Space Mono',monospace; font-size:16px; color:#fff; }
        .brand strong { color:#6366f1; }
        .user-box { display:flex; gap:10px; align-items:flex-start; padding:12px; background:rgba(99,102,241,0.08); border-radius:10px; }
        .avatar { width:36px; height:36px; background:#6366f1; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:15px; flex-shrink:0; }
        .uname { font-size:12px; font-weight:500; color:#fff; }
        .ureg { font-size:10px; color:rgba(255,255,255,0.35); font-family:'Space Mono',monospace; }
        .udept { font-size:10px; color:rgba(255,255,255,0.3); margin-top:2px; line-height:1.4; }
        .stats-mini { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
        .sm { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:8px; text-align:center; }
        .sm-v { font-family:'Space Mono',monospace; font-size:14px; font-weight:700; color:#fff; }
        .sm-l { font-size:9px; color:rgba(255,255,255,0.3); margin-top:2px; text-transform:uppercase; letter-spacing:0.5px; }
        nav { display:flex; flex-direction:column; gap:3px; flex:1; }
        .nb { background:none; border:none; color:rgba(255,255,255,0.4); text-align:left; padding:9px 12px; border-radius:8px; cursor:pointer; font-size:13px; font-family:'DM Sans',sans-serif; display:flex; align-items:center; gap:8px; transition:all 0.15s; }
        .nb:hover { background:rgba(255,255,255,0.05); color:#fff; }
        .nba { background:rgba(99,102,241,0.15); color:#a5b4fc; }
        .logout { background:none; border:1px solid rgba(255,255,255,0.08); color:rgba(255,255,255,0.3); padding:9px; border-radius:8px; cursor:pointer; font-size:12px; transition:all 0.15s; }
        .logout:hover { border-color:rgba(239,68,68,0.4); color:#fca5a5; }

        /* MAIN */
        .main { flex:1; padding:40px 44px; overflow-x:auto; }
        .title { font-family:'Space Mono',monospace; font-size:20px; color:#fff; margin-bottom:24px; letter-spacing:-0.5px; }

        /* STAT CARDS */
        .cards { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:28px; }
        .card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:18px; }
        .card-v { font-family:'Space Mono',monospace; font-size:26px; font-weight:700; }
        .card-l { font-size:11px; color:rgba(255,255,255,0.35); text-transform:uppercase; letter-spacing:0.8px; margin-top:4px; }

        /* ATTENDANCE LIST */
        .att-list { display:flex; flex-direction:column; gap:8px; }
        .att-row { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:16px 18px; display:flex; gap:16px; align-items:center; }
        .att-info { flex:1; }
        .att-name { font-size:14px; font-weight:500; color:#fff; margin-bottom:2px; }
        .att-meta { font-size:11px; color:rgba(255,255,255,0.35); margin-bottom:8px; }
        .bar-bg { height:4px; background:rgba(255,255,255,0.08); border-radius:2px; }
        .bar-fill { height:100%; border-radius:2px; }
        .att-right { text-align:right; flex-shrink:0; }
        .att-pct { font-family:'Space Mono',monospace; font-size:22px; font-weight:700; }
        .att-hours { font-size:11px; color:rgba(255,255,255,0.35); margin:2px 0 6px; }
        .att-margin { font-size:11px; padding:3px 8px; border-radius:6px; display:inline-block; }

        /* MARKS */
        .marks-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:14px; }
        .mark-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:18px; }
        .mk-top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; }
        .mk-code { font-family:'Space Mono',monospace; font-size:11px; color:#a5b4fc; margin-bottom:3px; }
        .mk-name { font-size:13px; color:#fff; font-weight:500; }
        .mk-score { font-family:'Space Mono',monospace; font-size:28px; font-weight:400; margin:10px 0 8px; }
        .mk-tot { font-size:16px; color:rgba(255,255,255,0.3); }
        .tests { margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; gap:5px; }
        .test-row { display:flex; justify-content:space-between; font-size:12px; color:rgba(255,255,255,0.4); }

        /* BADGE */
        .badge { font-size:10px; padding:3px 8px; border-radius:4px; font-weight:500; text-transform:uppercase; letter-spacing:0.5px; }
        .bt { background:rgba(99,102,241,0.15); color:#a5b4fc; }
        .bp { background:rgba(16,185,129,0.12); color:#6ee7b7; }

        /* TIMETABLE */
        .tt-scroll { overflow-x:auto; }
        .tt { border-collapse:collapse; min-width:900px; width:100%; }
        .tt th { padding:8px 10px; font-size:10px; color:rgba(255,255,255,0.3); border:1px solid rgba(255,255,255,0.06); text-align:center; background:rgba(255,255,255,0.02); }
        .tt td { border:1px solid rgba(255,255,255,0.05); padding:5px; height:58px; vertical-align:top; }
        .tt-day-h, .tt-day { font-size:12px; color:rgba(255,255,255,0.5); font-weight:500; white-space:nowrap; padding:8px 14px !important; }
        .slot { border-radius:6px; padding:6px 8px; height:100%; }
        .st { background:rgba(99,102,241,0.15); }
        .sp { background:rgba(16,185,129,0.1); }
        .slot-c { font-size:10px; font-family:'Space Mono',monospace; color:#a5b4fc; }
        .slot-r { font-size:9px; color:rgba(255,255,255,0.3); margin-top:2px; }

        /* COURSES */
        .courses-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:14px; }
        .course-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:18px; }
        .cc-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
        .cc-code { font-family:'Space Mono',monospace; font-size:12px; color:#a5b4fc; }
        .cc-title { font-size:14px; font-weight:500; color:#fff; margin-bottom:12px; line-height:1.4; }
        .cc-meta { display:flex; flex-direction:column; gap:5px; font-size:12px; color:rgba(255,255,255,0.4); }
      `}</style>
    </>
  );
}