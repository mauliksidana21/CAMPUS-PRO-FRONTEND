import { useState, useEffect } from "react";

export default function Home() {
  const [page, setPage] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPopup, setShowPopup] = useState(false);
  const [activeNav, setActiveNav] = useState("home");
  const [attendance, setAttendance] = useState([]);
  const [marks, setMarks] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [courses, setCourses] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("srm_cookie");
    const savedEmail = localStorage.getItem("srm_email");
    if (saved) {
      setCookie(saved);
      setUserEmail(savedEmail || "");
      setPage("app");
      loadAllData(saved);
    }
  }, []);

  const [cookie, setCookie] = useState("");

  // Listen for cookie from popup
  useEffect(() => {
    function handleMessage(e) {
      if (e.data?.type === "SRM_COOKIE") {
        const c = e.data.cookie;
        localStorage.setItem("srm_cookie", c);
        localStorage.setItem("srm_email", email);
        setCookie(c);
        setUserEmail(email);
        setShowPopup(false);
        setPage("app");
        loadAllData(c);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [email]);

  async function doLogin() {
    if (!email.trim() || !password.trim()) {
      setError("Email aur password daalo!");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: email, password }),
      });
      const data = await res.json();
      if (data.authenticated) {
        const tok = data.lookup?.digest;
        localStorage.setItem("srm_token", tok);
        localStorage.setItem("srm_email", email);
        setUserEmail(email);
        setPage("app");
        await loadAllData(tok);
      } else if (data.error?.includes("CAPTCHA") || data.session?.code?.includes("CAPTCHA") || !data.authenticated) {
        // Show popup for manual CAPTCHA
        setShowPopup(true);
      } else {
        setError("Invalid credentials. Try again.");
      }
    } catch (e) {
      setError("Server error. Try again.");
    }
    setLoading(false);
  }

  async function fetchAcademia(type, cookieVal) {
    const res = await fetch(`/api/academia?type=${type}`, {
      headers: { "x-cookie": cookieVal },
    });
    return res.json();
  }

  async function fetchWithToken(endpoint, token) {
    const res = await fetch(`/api/${endpoint}`, {
      headers: { "x-token": token },
    });
    return res.json();
  }

  function decodeHex(html) {
    const parts = html.split(".sanitize('");
    if (parts.length < 2) return html;
    const hex = parts[1].split("')")[0];
    return hex.replace(/\\x([0-9A-Fa-f]{2})/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    );
  }

  function parseAttendance(input) {
    // Handle both HTML string and API response object
    let html = typeof input === "string" ? input : input?.html || "";
    try {
      const decoded = decodeHex(html);
      const parser = new DOMParser();
      const doc = parser.parseFromString(decoded, "text/html");
      const rows = doc.querySelectorAll("td[bgcolor='#E6E6FA']");
      const result = [];
      rows.forEach((td) => {
        const code = td.textContent.trim();
        if (code.length > 5 && /^\d/.test(code)) {
          const cells = [];
          let next = td.nextElementSibling;
          while (next && cells.length < 8) {
            cells.push(next.textContent.trim());
            next = next.nextElementSibling;
          }
          const conducted = parseFloat(cells[5]) || 0;
          const absent = parseFloat(cells[6]) || 0;
          const pct = conducted > 0 ? ((conducted - absent) / conducted) * 100 : 0;
          if (cells[0] && cells[0].toLowerCase() !== "null") {
            result.push({
              courseCode: code.replace("Regular", "").trim(),
              courseTitle: cells[0].split("–")[0].trim(),
              facultyName: cells[2] || "",
              slot: cells[3] || "",
              hoursConducted: conducted,
              hoursAbsent: absent,
              attendancePercentage: pct.toFixed(2),
            });
          }
        }
      });
      // If parsed from HTML, return result
      if (result.length > 0) return result;
      // Fallback: try as goscraper API response
      const apiData = typeof input === "object" ? input : null;
      if (apiData?.attendance) {
        return apiData.attendance.map((a) => ({
          courseCode: a.courseCode || "",
          courseTitle: a.courseTitle || "",
          facultyName: a.facultyName || "",
          slot: a.slot || "",
          hoursConducted: parseFloat(a.hoursConducted) || 0,
          hoursAbsent: parseFloat(a.hoursAbsent) || 0,
          attendancePercentage: a.attendancePercentage || "0",
        }));
      }
      return result;
    } catch (e) {
      return [];
    }
  }

  function parseTimetable(input) {
    let html = typeof input === "string" ? input : input?.html || "";
    try {
      const decoded = decodeHex(html);
      const parser = new DOMParser();
      const doc = parser.parseFromString(decoded, "text/html");
      const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
      const result = [];
      doc.querySelectorAll("tr").forEach((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length > 1) {
          const dayText = cells[0]?.textContent.trim().toUpperCase().slice(0, 3);
          if (days.includes(dayText)) {
            const classes = [];
            cells.forEach((cell, i) => {
              if (i > 0) {
                const text = cell.textContent.trim();
                if (text && text.length > 3 && !/^\d+$/.test(text) && text !== "-") {
                  classes.push({ name: text });
                }
              }
            });
            if (classes.length > 0) result.push({ day: dayText, classes });
          }
        }
      });
      if (result.length > 0) return result;
      // Fallback goscraper
      const apiData = typeof input === "object" ? input : null;
      if (apiData?.schedule) return apiData.schedule;
      return result;
    } catch (e) {
      return [];
    }
  }

  function parseMarks(input) {
    let html = typeof input === "string" ? input : input?.html || "";
    try {
      const decoded = decodeHex(html);
      const parser = new DOMParser();
      const doc = parser.parseFromString(decoded, "text/html");
      const result = [];
      doc.querySelectorAll("tr").forEach((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length >= 3) {
          const code = cells[0]?.textContent.trim();
          const type = cells[1]?.textContent.trim();
          if (code && code.length > 3 && /\d/.test(code) && (type === "Theory" || type === "Practical")) {
            const tests = [];
            cells[2]?.querySelectorAll("td").forEach((tc) => {
              const t = tc.textContent.trim();
              if (t.includes("/")) tests.push(t);
            });
            result.push({ courseCode: code, courseType: type, tests });
          }
        }
      });
      if (result.length > 0) return result;
      const apiData = typeof input === "object" ? input : null;
      if (apiData?.marks) {
        return apiData.marks.map((m) => ({
          courseCode: m.courseCode || "",
          courseType: m.courseType || "",
          tests: m.testPerformance?.map((t) => `${t.test}: ${t.marks?.scored}/${t.marks?.total}`) || [],
        }));
      }
      return result;
    } catch (e) {
      return [];
    }
  }

  async function loadAllData(tokenOrCookie) {
    setDataLoading(true);
    try {
      // Try cookie-based first
      const isCookie = tokenOrCookie.includes("=") && tokenOrCookie.length > 100;
      if (isCookie) {
        const [attData, ttData, marksData] = await Promise.all([
          fetchAcademia("attendance", tokenOrCookie),
          fetchAcademia("timetable", tokenOrCookie),
          fetchAcademia("marks", tokenOrCookie),
        ]);
        const att = parseAttendance(attData);
        setAttendance(att);
        setTimetable(parseTimetable(ttData));
        setMarks(parseMarks(marksData));
        setCourses(att.map((a) => ({ courseTitle: a.courseTitle, courseCode: a.courseCode, facultyName: a.facultyName, credit: 3 })));
      } else {
        // Token based (goscraper)
        const [attData, marksData, ttData] = await Promise.all([
          fetchWithToken("attendance", tokenOrCookie),
          fetchWithToken("marks", tokenOrCookie),
          fetchWithToken("timetable", tokenOrCookie),
        ]);
        const att = parseAttendance(attData);
        setAttendance(att);
        setTimetable(parseTimetable(ttData));
        setMarks(parseMarks(marksData));
        setCourses(att.map((a) => ({ courseTitle: a.courseTitle, courseCode: a.courseCode, facultyName: a.facultyName, credit: 3 })));
      }
    } catch (e) {
      console.error(e);
    }
    setDataLoading(false);
  }

  function doLogout() {
    localStorage.clear();
    setEmail(""); setPassword(""); setCookie("");
    setAttendance([]); setMarks([]); setTimetable([]); setCourses([]);
    setPage("login");
  }

  const avgAtt = attendance.length > 0
    ? (attendance.reduce((s, a) => s + parseFloat(a.attendancePercentage), 0) / attendance.length).toFixed(1)
    : null;

  if (page === "login") {
    return (
      <div style={S.loginBg}>
        {/* CAPTCHA Popup */}
        {showPopup && (
          <div style={S.popupOverlay}>
            <div style={S.popupCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#e8edf8" }}>Complete Login on Academia</div>
                <button onClick={() => setShowPopup(false)} style={{ background: "transparent", border: "none", color: "#8a9bc4", fontSize: 20, cursor: "pointer" }}>×</button>
              </div>
              <div style={{ fontSize: 12, color: "#8a9bc4", marginBottom: 12 }}>
                1. CAPTCHA solve karo → Login karo<br />
                2. Login hone ke baad yeh window band ho jaayegi automatically<br />
                3. Agar band na ho toh neeche button dabao
              </div>
              <iframe
                src={`https://academia.srmist.edu.in/accounts/p/40-10002227248/signin/v2/lookup/${email}`}
                style={{ width: "100%", height: 500, border: "none", borderRadius: 10 }}
                title="SRM Login"
              />
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button
                  style={{ ...S.loginBtn, background: "#00c97a" }}
                  onClick={() => {
                    // Try to grab cookie after manual login
                    const c = localStorage.getItem("srm_cookie_from_iframe") || "";
                    if (c) {
                      localStorage.setItem("srm_cookie", c);
                      setPage("app");
                      loadAllData(c);
                      setShowPopup(false);
                    } else {
                      // Ask user to copy cookie manually
                      setShowPopup(false);
                      alert("Login ho gaya! Ab F12 → Console → document.cookie copy karo aur refresh karo.");
                    }
                  }}
                >
                  Login Ho Gaya ✓
                </button>
                <button onClick={() => setShowPopup(false)} style={{ ...S.loginBtn, background: "transparent", border: "1px solid #1e2d4d", color: "#8a9bc4" }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        <div style={S.loginCard}>
          <div style={S.badge}>★ SRM University Portal</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#e8edf8", margin: "0 0 6px" }}>
            Campus<span style={{ color: "#e8192c" }}>Pro.</span>
          </h1>
          <p style={{ fontSize: 13, color: "#8a9bc4", marginBottom: 28 }}>
            Sign in to access your academic dashboard
          </p>
          {error && <div style={S.errorBox}>{error}</div>}
          <label style={S.fieldLabel}>SRM Email</label>
          <input
            style={S.inputField}
            placeholder="ms5215@srmist.edu.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label style={S.fieldLabel}>Password</label>
          <input
            type="password"
            style={S.inputField}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doLogin()}
          />
          <button style={S.loginBtn} onClick={doLogin} disabled={loading}>
            {loading ? "Signing in..." : "Sign In →"}
          </button>
          <div style={{ marginTop: 14, fontSize: 11, color: "#8a9bc4", textAlign: "center" }}>
            🔒 Your credentials are secure
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.appWrap}>
      <div style={S.sidebar}>
        <div style={{ padding: "20px 18px 12px", borderBottom: "1px solid #1e2d4d" }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#e8edf8" }}>
            Campus<span style={{ color: "#e8192c" }}>Pro.</span>
          </span>
        </div>
        <div style={{ margin: "14px 18px 10px", background: "#111d35", border: "1px solid #1e2d4d", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, background: "#1a6cf0", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: "#fff" }}>
            {userEmail.slice(0, 2).toUpperCase() || "SR"}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#e8edf8", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail || "SRM Student"}</div>
            <div style={{ fontSize: 11, color: "#8a9bc4" }}>SRM Student</div>
          </div>
        </div>
        <nav style={{ padding: "8px 10px", flex: 1 }}>
          {[
            { id: "home", icon: "⊞", label: "Home" },
            { id: "timetable", icon: "◷", label: "Timetable" },
            { id: "attendance", icon: "✓", label: "Attendance" },
            { id: "marks", icon: "◈", label: "Marks" },
            { id: "courses", icon: "◉", label: "Courses" },
            { id: "gpa", icon: "∑", label: "GPA Calc" },
            { id: "predictor", icon: "◆", label: "Predictor" },
          ].map((n) => (
            <div key={n.id} style={{ ...S.navItem, ...(activeNav === n.id ? S.navActive : {}) }} onClick={() => setActiveNav(n.id)}>
              <span>{n.icon}</span> {n.label}
            </div>
          ))}
        </nav>
        <button style={S.logoutBtn} onClick={doLogout}>↩ Sign Out</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {dataLoading && (
          <div style={{ background: "#0d1f3c", borderBottom: "1px solid #1a6cf0", padding: "10px 20px", fontSize: 13, color: "#5b9bff", textAlign: "center" }}>
            ⏳ Loading your data from SRM Academia...
          </div>
        )}

        {activeNav === "home" && (
          <div style={S.content}>
            <div style={{ background: "#0d1f3c", border: "1px solid #1a6cf0", borderRadius: 16, padding: "20px 24px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#e8edf8" }}>
                  {new Date().getHours() < 12 ? "Good Morning! 🌅" : new Date().getHours() < 17 ? "Good Afternoon! ☀️" : "Good Evening! 🌙"}
                </div>
                <div style={{ fontSize: 13, color: "#8a9bc4", marginTop: 4 }}>{userEmail} · SRM Student</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#e8edf8" }}>{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</div>
                <div style={{ fontSize: 12, color: "#8a9bc4" }}>{new Date().toLocaleDateString("en-IN", { weekday: "long" })}</div>
              </div>
            </div>
            <div style={S.statGrid}>
              {[
                { label: "Total Subjects", val: attendance.length || "—", color: "#5b9bff" },
                { label: "Below 75%", val: attendance.filter(a => parseFloat(a.attendancePercentage) < 75).length, color: "#e8192c" },
                { label: "Avg Attendance", val: avgAtt ? avgAtt + "%" : "—", color: "#00c97a" },
                { label: "Marks Entries", val: marks.length || "—", color: "#f5c842" },
              ].map((c, i) => (
                <div key={i} style={S.statCard}>
                  <div style={S.statLabel}>{c.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: c.color }}>{c.val}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#e8edf8", marginBottom: 12 }}>Attendance Overview</div>
            {attendance.length === 0 ? (
              <div style={S.emptyBox}>{dataLoading ? "Loading..." : "No data loaded"}</div>
            ) : (
              attendance.map((a, i) => {
                const pct = parseFloat(a.attendancePercentage);
                const color = pct >= 75 ? "#00c97a" : pct >= 65 ? "#f5c842" : "#e8192c";
                return (
                  <div key={i} style={S.attRow}>
                    <div style={{ flex: 1 }}>
                      <div style={S.attSubject}>{a.courseTitle}</div>
                      <div style={S.attCode}>{a.courseCode} · {a.facultyName}</div>
                      <div style={S.barWrap}><div style={{ ...S.bar, width: `${Math.min(pct, 100)}%`, background: color }} /></div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color }}>{pct.toFixed(1)}%</div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeNav === "timetable" && (
          <div style={S.content}>
            <div style={S.pageTitle}>Timetable</div>
            <div style={S.pageSub}>Weekly class schedule</div>
            {timetable.length === 0 ? (
              <div style={S.emptyBox}>{dataLoading ? "Loading..." : "No timetable data"}</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
                {timetable.map((day, i) => (
                  <div key={i} style={{ background: "#0e1726", border: "1px solid #1e2d4d", borderRadius: 12, padding: "12px 10px" }}>
                    <div style={{ fontSize: 10, color: "#8a9bc4", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, fontWeight: 600 }}>{day.day}</div>
                    {(day.classes || []).map((c, j) => (
                      <div key={j} style={{ background: "#111d35", borderLeft: "3px solid #1a6cf0", borderRadius: 6, padding: "7px 8px", marginBottom: 5 }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: "#e8edf8" }}>{c.courseTitle || c.name}</div>
                        {(c.startTime || c.roomNo) && <div style={{ fontSize: 10, color: "#5b9bff" }}>{c.startTime ? `${c.startTime}–${c.endTime}` : c.roomNo}</div>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeNav === "attendance" && (
          <div style={S.content}>
            <div style={S.pageTitle}>Attendance Tracker</div>
            <div style={S.pageSub}>Real-time from SRM Academia</div>
            <div style={S.statGrid}>
              {[
                { label: "Overall", val: avgAtt ? avgAtt + "%" : "—", color: "#5b9bff" },
                { label: "Safe ≥75%", val: attendance.filter(a => parseFloat(a.attendancePercentage) >= 75).length, color: "#00c97a" },
                { label: "Danger <75%", val: attendance.filter(a => parseFloat(a.attendancePercentage) < 75).length, color: "#e8192c" },
                { label: "Total", val: attendance.length, color: "#f5c842" },
              ].map((c, i) => (
                <div key={i} style={S.statCard}><div style={S.statLabel}>{c.label}</div><div style={{ fontSize: 26, fontWeight: 700, color: c.color }}>{c.val}</div></div>
              ))}
            </div>
            {attendance.length === 0 ? (
              <div style={S.emptyBox}>{dataLoading ? "Loading..." : "No data"}</div>
            ) : (
              attendance.map((a, i) => {
                const pct = parseFloat(a.attendancePercentage);
                const color = pct >= 75 ? "#00c97a" : pct >= 65 ? "#f5c842" : "#e8192c";
                const attended = a.hoursConducted - a.hoursAbsent;
                const margin = Math.floor(attended - 0.75 * a.hoursConducted);
                return (
                  <div key={i} style={S.attRow}>
                    <div style={{ flex: 1 }}>
                      <div style={S.attSubject}>{a.courseTitle}</div>
                      <div style={S.attCode}>{a.courseCode} · {attended}/{a.hoursConducted} classes · {a.facultyName}</div>
                      <div style={S.barWrap}><div style={{ ...S.bar, width: `${Math.min(pct, 100)}%`, background: color }} /></div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 110 }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color }}>{pct.toFixed(1)}%</div>
                      <div style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, marginTop: 4, background: margin >= 0 ? "#001f10" : "#1f0508", color: margin >= 0 ? "#00c97a" : "#e8192c" }}>
                        {margin >= 0 ? `Can miss ${margin}` : `Need ${Math.abs(margin)} more`}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeNav === "marks" && (
          <div style={S.content}>
            <div style={S.pageTitle}>Marks & Grades</div>
            <div style={S.pageSub}>Assessment scores from SRM Academia</div>
            {marks.length === 0 ? (
              <div style={S.emptyBox}>{dataLoading ? "Loading..." : "No marks data"}</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {marks.map((m, i) => (
                  <div key={i} style={{ background: "#0e1726", border: "1px solid #1e2d4d", borderRadius: 14, padding: 18 }}>
                    <div style={S.attSubject}>{m.courseName || m.courseCode}</div>
                    <div style={S.attCode}>{m.courseCode} · {m.courseType}</div>
                    {m.overall?.scored && (
                      <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, color: "#8a9bc4" }}>Overall</span>
                        <span style={{ fontSize: 18, fontWeight: 700, color: "#5b9bff" }}>{m.overall.scored}/{m.overall.total}</span>
                      </div>
                    )}
                    {m.tests?.map((t, j) => (
                      <div key={j} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1e2d4d", fontSize: 12 }}>
                        <span style={{ color: "#8a9bc4" }}>Test {j + 1}</span>
                        <span style={{ fontWeight: 500, color: "#e8edf8" }}>{t}</span>
                      </div>
                    ))}
                    {m.testPerformance?.map((t, j) => (
                      <div key={j} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1e2d4d", fontSize: 12 }}>
                        <span style={{ color: "#8a9bc4" }}>{t.test}</span>
                        <span style={{ fontWeight: 500, color: "#e8edf8" }}>{t.marks?.scored}/{t.marks?.total}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeNav === "courses" && (
          <div style={S.content}>
            <div style={S.pageTitle}>Courses & Faculty</div>
            <div style={S.pageSub}>Enrolled courses this semester</div>
            {courses.length === 0 ? (
              <div style={S.emptyBox}>{dataLoading ? "Loading..." : "No course data"}</div>
            ) : (
              courses.map((c, i) => (
                <div key={i} style={{ background: "#0e1726", border: "1px solid #1e2d4d", borderRadius: 14, padding: "18px 20px", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <div style={S.attSubject}>{c.courseTitle || c.courseName}</div>
                      <div style={S.attCode}>{c.courseCode}</div>
                    </div>
                    <div style={{ background: "#0d1f3c", color: "#5b9bff", fontSize: 11, padding: "3px 10px", borderRadius: 20, height: "fit-content" }}>{c.credit || 3} Credits</div>
                  </div>
                  {c.facultyName && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#111d35", borderRadius: 8, marginTop: 8 }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#1a6cf0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "#fff" }}>
                        {c.facultyName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, color: "#e8edf8", fontWeight: 500 }}>{c.facultyName}</div>
                        {c.facultyEmail && <div style={{ fontSize: 11, color: "#8a9bc4" }}>{c.facultyEmail}</div>}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeNav === "gpa" && <GPACalc subjects={attendance} />}
        {activeNav === "predictor" && <Predictor attendance={attendance} />}
      </div>
    </div>
  );
}

function GPACalc({ subjects }) {
  const gp = { O: 10, "A+": 9, A: 8, "B+": 7, B: 6, C: 5, F: 0 };
  const list = subjects.length > 0 ? subjects : [{ courseTitle: "Subject 1" }, { courseTitle: "Subject 2" }, { courseTitle: "Subject 3" }];
  const [grades, setGrades] = useState({});
  const [credits, setCredits] = useState({});
  const tc = list.reduce((s, _, i) => s + (parseInt(credits[i]) || 3), 0);
  const wp = list.reduce((s, _, i) => s + (gp[grades[i] || "A"] * (parseInt(credits[i]) || 3)), 0);
  const gpa = tc > 0 ? (wp / tc).toFixed(2) : "0.00";
  return (
    <div style={S.content}>
      <div style={S.pageTitle}>GPA Calculator</div>
      <div style={S.pageSub}>Grade change karo — live update hoga</div>
      <div style={{ background: "#0e1726", border: "1px solid #1e2d4d", borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#111d35" }}>
            {["Subject", "Credits", "Grade", "Points"].map(h => <th key={h} style={{ padding: "10px 14px", fontSize: 11, color: "#8a9bc4", textAlign: "left", textTransform: "uppercase" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {list.map((c, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #1e2d4d" }}>
                <td style={{ padding: "10px 14px", fontSize: 13, color: "#e8edf8" }}>{c.courseTitle}</td>
                <td style={{ padding: "10px 14px" }}><input type="number" min="1" max="6" defaultValue="3" style={S.gpaInput} onChange={e => setCredits({ ...credits, [i]: e.target.value })} /></td>
                <td style={{ padding: "10px 14px" }}><select style={S.gpaInput} value={grades[i] || "A"} onChange={e => setGrades({ ...grades, [i]: e.target.value })}>{Object.keys(gp).map(g => <option key={g}>{g}</option>)}</select></td>
                <td style={{ padding: "10px 14px", fontSize: 13, color: "#5b9bff", fontWeight: 600 }}>{gp[grades[i] || "A"]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ background: "#0d1f3c", border: "1px solid #1a6cf0", borderRadius: 16, padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 12, color: "#8a9bc4", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Semester GPA</div>
        <div style={{ fontSize: 56, fontWeight: 700, color: "#5b9bff" }}>{gpa}</div>
        <div style={{ fontSize: 13, color: "#8a9bc4" }}>{gpa >= 9 ? "First Class with Distinction 🏆" : gpa >= 7.5 ? "First Class 🎉" : gpa >= 6 ? "Second Class" : "Pass Class"}</div>
      </div>
    </div>
  );
}

function Predictor({ attendance }) {
  const [sel, setSel] = useState(0);
  const [hol, setHol] = useState(0);
  const [rem, setRem] = useState(30);
  const [result, setResult] = useState(null);
  function calculate() {
    const a = attendance[sel]; if (!a) return;
    const conducted = parseFloat(a.hoursConducted) || 0;
    const absent = parseFloat(a.hoursAbsent) || 0;
    const attended = conducted - absent;
    const ft = conducted + rem;
    const fa = attended + (rem - hol);
    const fp = ((fa / ft) * 100).toFixed(1);
    const margin = Math.floor(fa - 0.75 * ft);
    setResult({ fp, margin, safe: parseFloat(fp) >= 75, name: a.courseTitle });
  }
  return (
    <div style={S.content}>
      <div style={S.pageTitle}>Attendance Predictor</div>
      <div style={S.pageSub}>Plan karo — kitni classes chhod sakte ho</div>
      <div style={{ background: "#0e1726", border: "1px solid #1e2d4d", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={S.statLabel}>Subject</div>
          <select style={{ ...S.gpaInput, width: "100%", padding: "10px 12px" }} onChange={e => setSel(parseInt(e.target.value))}>
            {attendance.length > 0 ? attendance.map((a, i) => <option key={i} value={i}>{a.courseTitle} ({a.attendancePercentage}%)</option>) : <option>Pehle login karo</option>}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div><div style={S.statLabel}>Remaining classes</div><input type="number" style={{ ...S.gpaInput, width: "100%" }} value={rem} onChange={e => setRem(parseInt(e.target.value) || 0)} /></div>
          <div><div style={S.statLabel}>Classes to miss</div><input type="number" style={{ ...S.gpaInput, width: "100%" }} value={hol} onChange={e => setHol(parseInt(e.target.value) || 0)} /></div>
        </div>
        <button style={{ background: "#e8192c", border: "none", borderRadius: 10, padding: "10px 24px", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }} onClick={calculate}>Calculate →</button>
      </div>
      {result && (
        <div style={{ background: "#0e1726", border: `1px solid ${result.safe ? "#00c97a" : "#e8192c"}`, borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 13, color: "#8a9bc4", marginBottom: 12 }}>{result.name}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 14 }}>
            {[
              { val: result.fp + "%", label: "Final Attendance", color: result.safe ? "#5b9bff" : "#e8192c" },
              { val: result.margin >= 0 ? `+${result.margin}` : result.margin, label: "Margin", color: result.margin >= 0 ? "#f5c842" : "#e8192c" },
              { val: result.safe ? "Safe ✓" : "Danger ✗", label: "Status", color: result.safe ? "#00c97a" : "#e8192c" },
            ].map((r, i) => (
              <div key={i} style={{ background: "#111d35", borderRadius: 10, padding: 14, textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: r.color }}>{r.val}</div>
                <div style={{ fontSize: 11, color: "#8a9bc4", marginTop: 4 }}>{r.label}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, background: result.safe ? "#001f10" : "#1f0508", color: result.safe ? "#00c97a" : "#e8192c" }}>
            {result.safe ? `✓ Safe! ${result.fp}% hogi. ${result.margin} classes ka margin.` : `⚠ ${Math.abs(result.margin)} aur attend karo!`}
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  loginBg: { minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  loginCard: { background: "#0e1726", border: "1px solid #1e2d4d", borderRadius: 20, padding: "40px 36px", width: "100%", maxWidth: 420 },
  badge: { display: "inline-block", background: "#0d1f3c", border: "1px solid #1a6cf0", borderRadius: 20, padding: "5px 14px", fontSize: 12, color: "#5b9bff", marginBottom: 20 },
  fieldLabel: { fontSize: 12, color: "#8a9bc4", marginBottom: 6, display: "block", fontWeight: 500 },
  inputField: { width: "100%", background: "#111d35", border: "1px solid #1e2d4d", borderRadius: 10, padding: "12px 14px", color: "#e8edf8", fontSize: 14, marginBottom: 16, outline: "none", boxSizing: "border-box", fontFamily: "inherit" },
  loginBtn: { width: "100%", background: "#1a6cf0", border: "none", borderRadius: 10, padding: 13, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  errorBox: { background: "#1a0a0e", border: "1px solid #e8192c", color: "#ff7080", borderRadius: 8, padding: "9px 12px", fontSize: 12, marginBottom: 16 },
  popupOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  popupCard: { background: "#0e1726", border: "1px solid #1e2d4d", borderRadius: 16, padding: 20, width: "100%", maxWidth: 600 },
  appWrap: { display: "flex", minHeight: "100vh", background: "#0a0f1e" },
  sidebar: { width: 220, background: "#0d1528", borderRight: "1px solid #1e2d4d", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" },
  navItem: { display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 8, cursor: "pointer", color: "#b0bdd8", fontSize: 13, marginBottom: 2 },
  navActive: { background: "#1a6cf0", color: "#fff", fontWeight: 500 },
  logoutBtn: { margin: 10, padding: 9, background: "transparent", border: "1px solid #1e2d4d", borderRadius: 8, color: "#8a9bc4", fontSize: 12, cursor: "pointer" },
  content: { padding: 28 },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 },
  statCard: { background: "#0e1726", border: "1px solid #1e2d4d", borderRadius: 14, padding: "16px 18px" },
  statLabel: { fontSize: 11, color: "#8a9bc4", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  pageTitle: { fontSize: 22, fontWeight: 700, color: "#e8edf8", marginBottom: 4 },
  pageSub: { fontSize: 13, color: "#8a9bc4", marginBottom: 24 },
  attRow: { background: "#0e1726", border: "1px solid #1e2d4d", borderRadius: 12, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 },
  attSubject: { fontSize: 13, fontWeight: 500, color: "#e8edf8" },
  attCode: { fontSize: 11, color: "#8a9bc4", marginTop: 2 },
  barWrap: { height: 6, background: "#1e2d4d", borderRadius: 4, overflow: "hidden", marginTop: 6 },
  bar: { height: "100%", borderRadius: 4 },
  emptyBox: { background: "#0e1726", border: "1px solid #1e2d4d", borderRadius: 12, padding: 20, color: "#8a9bc4", fontSize: 13, textAlign: "center" },
  gpaInput: { background: "#111d35", border: "1px solid #1e2d4d", borderRadius: 6, padding: "6px 10px", color: "#e8edf8", fontSize: 13, outline: "none", fontFamily: "inherit" },
};
