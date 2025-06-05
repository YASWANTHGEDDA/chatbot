const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.API_GATEWAY_PORT || 3000;
const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://localhost:8000';
const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:8001';
const KG_SERVICE_URL = process.env.KG_SERVICE_URL || 'http://localhost:8002';

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Proxy to LLM Service
app.post('/message', async (req, res) => {
  try {
    const response = await axios.post(`${LLM_SERVICE_URL}/generate`, req.body);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy to RAG Service
app.post('/rag', async (req, res) => {
  try {
    const response = await axios.post(`${RAG_SERVICE_URL}/search`, req.body);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy to KG Service
app.post('/kg/extract', async (req, res) => {
  try {
    const response = await axios.post(`${KG_SERVICE_URL}/extract`, req.body);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/kg/query', async (req, res) => {
  try {
    const response = await axios.post(`${KG_SERVICE_URL}/query_kg_for_rag`, req.body);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/kg/visualize', async (req, res) => {
  try {
    const { doc_filename } = req.query;
    const response = await axios.get(`${KG_SERVICE_URL}/visualize`, { params: { doc_filename } });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
}); 