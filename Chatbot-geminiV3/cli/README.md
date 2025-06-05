# Chatbot Frontend

This is the frontend application for the Agentic AI system, built with React and Material-UI.

## Features

- Real-time chat interface with streaming responses
- LLM model selection and configuration
- Knowledge Graph visualization
- RAG (Retrieval-Augmented Generation) integration
- File management and document indexing
- Chat history management
- Responsive design

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

Create a `.env` file in the root directory with the following configuration:

```env
# API Gateway
REACT_APP_API_GATEWAY_PORT=5001

# LLM Service
REACT_APP_LLM_SERVICE_PORT=5002

# RAG Service
REACT_APP_RAG_SERVICE_PORT=5003

# Knowledge Graph Service
REACT_APP_KG_SERVICE_PORT=5004
```

## Development

Start the development server:

```bash
npm start
```

The application will be available at `http://localhost:3000`.

## Building for Production

Build the production version:

```bash
npm run build
```

The build artifacts will be stored in the `build/` directory.

## Project Structure

```
src/
  ├── components/           # React components
  │   ├── ChatPage.js      # Main chat interface
  │   ├── LLMConfigWidget.js # LLM configuration
  │   ├── KnowledgeGraphWidget.js # Knowledge graph visualization
  │   └── ...
  ├── services/            # API services
  │   └── api.js          # API client configuration
  ├── App.js              # Main application component
  └── index.js            # Application entry point
```

## API Integration

The frontend communicates with the following microservices:

1. API Gateway (Port 5001)
   - Authentication
   - Chat history
   - File management

2. LLM Service (Port 5002)
   - Model selection
   - Text generation
   - Streaming responses

3. RAG Service (Port 5003)
   - Document indexing
   - Semantic search
   - Context retrieval

4. Knowledge Graph Service (Port 5004)
   - Graph visualization
   - Entity relationships
   - Graph queries

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License. 