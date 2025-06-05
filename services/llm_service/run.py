import uvicorn
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

if __name__ == "__main__":
    # Get port from environment or use default
    port = int(os.getenv("LLM_SERVICE_PORT", "8000"))
    
    # Run the service
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=port,
        reload=True  # Enable auto-reload during development
    ) 