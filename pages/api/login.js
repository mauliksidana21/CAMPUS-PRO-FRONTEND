export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { account, password } = req.body
  try {
    const response = await fetch('http://localhost:8080/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'undefined',
      },
      body: JSON.stringify({ account, password })
    })
    const data = await response.json()
    res.status(200).json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}