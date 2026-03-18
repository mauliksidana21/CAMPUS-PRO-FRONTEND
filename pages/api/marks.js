export default async function handler(req, res) {
  const token = req.headers['x-token']
  try {
    const r = await fetch('http://localhost:8080/marks', {
      headers: { 'X-CSRF-Token': 'undefined', 'token': token }
    })
    res.status(200).json(await r.json())
  } catch (e) { res.status(500).json({ error: e.message }) }
}