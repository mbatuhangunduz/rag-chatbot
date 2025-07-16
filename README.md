# Incision Rag Powered ChatBot

## Medical Device RAG Chatbot
A Node.js/TypeScript API that provides intelligent question-answering capabilities for medical device manuals using Retrieval-Augmented Generation (RAG) technology.


## Prerequisites

Make sure you have the following installed:

- Node.js 16+
- OpenAI API key
- Pinecone account and API key
- TypeScript


## Installation Steps

### 1. Clone the repository and switch to main branch

git clone https://github.com/mbatuhangunduz/rag-chatbot.git
git switch main

### 2. Install Dependencies

npm install

### 3. Set Up .env File
Create a .env file in the root directory of your project to store environment variables.

Example .env file:

OPENAI_API_KEY=your_openai_api_key_here
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=your_pinecone_index_name
PORT=3000
NODE_ENV=development

## Running the Application

npm run dev

The API will be available at http://localhost:3000

## API Endpoints

### 1. Initialize System

POST /initialize

Processes all PDF files in the documents directory and prepares the system for queries.



## Architecture

### 1- Core Components

# a.Document Processor: 
    Handles PDF parsing and text chunking
# b.Vector Service: 
    Manages embeddings and vector search
# c.RAG Service: 
    Orchestrates the retrieval and generation process
# d.API Routes: 
    Express.js endpoints for client interaction

### 2- Data Flow

# a. Initialization: 
    PDFs → Text Extraction → Chunking → Embeddings → Vector DB
    Query: Question → Embedding → Vector Search → Context Retrieval → Answer Generation

### 3- Configuration

All configuration is managed through src/config/config.ts:

OpenAI Settings: Model selection, API keys
Pinecone Settings: Index configuration
Document Processing: Chunk size, overlap settings
Search Parameters: Relevance thresholds, context limits

## Future Enhancements

- Support for additional document formats (Since the initialization API uploads existing documents, the sync API may be required for documents that will be added later.)

- For documents containing tables or columns, and especially for multilingual documents, a more proper PDF extraction system can be set up. 

- The cache system can be integrated.

- Requests can be regulated according to Pinecone and Openai rate limits.



## Project Structure


medical-device-rag-chatbot/
├── src/
│   ├── index.ts                  # Application starting point
│   ├── app.ts                    # MedicalDeviceRAGChatbot class 
│   │
│   ├── controllers/              # Controller layer
│   │   ├── index.ts             # Controller exports
│   │   ├── healthController.ts  # Healtch checking controller
│   │   ├── initController.ts    # System initialization controller
│   │   ├── queryController.ts   # Query processing controller
│   │   └── documentController.ts # Document processing controller
│   │
│   ├── routes/                   # Route layer
│   │   ├── index.ts             # Main routes class 
│   │   ├── healthRoutes.ts      # Health checking routes
│   │   ├── initRoutes.ts        # System initialization routes
│   │   ├── queryRoutes.ts       # Query processing routes
│   │   ├── documentRoutes.ts    # Document routes
│   │   └── routeTypes.ts        # Route type defines
│   │
│   ├── services/                 # Service layer
│   │   ├── ragService.ts        # RAG main class 
│   │   ├── documentProcessor.ts # PDF işleme servisi 
│   │   └── vectorService.ts     # Vektör işlemleri servisi 
│   │
│   ├── middleware/               # Middleware layer
│   │   └── index.ts             # Middleware and error handler 
│   │
│   ├── config/                   # Configuration folder
│   │   └── config.ts            # App configuration 
│   │
│   ├── types/                    #  - Type Definition
│   │   └── index.ts             # All type definitions
│   │
│   └── documents/                #  - PDF file directory
│       ├── Alcon_Centurion_Vision_System_Operator_s_Manual.pdf           
│       ├── Karl_Storz_-_Endoscope.pdf
│       └── Zeiss_OPMI_Pentero.pdf
│
├── package.json                  # Node.js dependencies
├── tsconfig.json                # TypeScript configuration
├── .env                         # Environment variables
├── .gitignore                   # Git ignore file
└── README.md                    # Proje documentation
