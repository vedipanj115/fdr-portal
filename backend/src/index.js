// Backend skeleton — Preet owns this folder.
// Next steps: connect PostgreSQL (pg), add auth, implement the endpoints in docs/api-contract.md.
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true, service: 'fdr-portal-backend' }));

app.get('/api/fdrs', (req, res) => {
  // TODO: replace with a database query
  res.json([]);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
