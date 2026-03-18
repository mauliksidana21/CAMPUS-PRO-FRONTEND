export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { type } = req.query
  const cookie = req.headers['x-cookie']

  if (!cookie) return res.status(400).json({ error: 'No cookie provided' })

  const pages = {
    attendance: 'My_Attendance',
    timetable: 'My_Time_Table_WFH',
    marks: 'My_Attendance',
    courses: 'My_Academics_UnivExam',
  }

  try {
    const response = await fetch(
      `https://academia.srmist.edu.in/srm_university/academia-academic-services/page/${pages[type]}`,
      {
        method: 'GET',
        headers: {
          'Cookie': cookie,
          'Accept': 'text/html,application/xhtml+xml,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Connection': 'keep-alive',
          'Referer': 'https://academia.srmist.edu.in/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'dnt': '1',
        }
      }
    )
    const text = await response.text()
    res.status(200).json({ html: text, status: response.status })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
