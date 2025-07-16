import { MedicalDeviceRAGChatbot } from './app';
import logger from './utils/logger';

// Start the server using singleton pattern
logger.info('Starting Medical Device RAG Chatbot...');

const chatbot = MedicalDeviceRAGChatbot.getInstance();

chatbot.start().catch((error) => {
  logger.error(`Failed to start application: ${error}`);
  process.exit(1);
});