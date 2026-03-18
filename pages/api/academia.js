export default async function handler(req, res) {
  const token = req.headers['x-csrf-token'];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const response = await fetch('http://localhost:8080/get', {
      headers: { 'X-CSRF-Token': token },
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ error: 'Backend unreachable' });
  }
}