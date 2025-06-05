// server/services/kgService.js
const axios = require('axios');
const config = require('../rag_service/config');

/**
 * Knowledge Graph Service
 * Provides functions to interact with the Knowledge Graph service
 */
module.exports = {
  /**
   * Queries the Knowledge Graph service for entities and relationships related to a query
   * @param {string} query - The user query
   * @param {string} userId - The user ID
   * @param {Array} relevantDocs - Optional array of relevant documents from RAG
   * @returns {Object} Knowledge graph data including nodes and edges
   */
  getKnowledgeGraphData: async (query, userId, relevantDocs = []) => {
    try {
      // Get KG service URL from config or environment variable
      const kgServiceUrl = process.env.KG_SERVICE_URL || 'http://localhost:5001';
      
      // Extract entity mentions from relevant docs to help focus the KG query
      const docTexts = relevantDocs.map(doc => doc.content || '').join(' ');
      const entityMentions = extractEntityMentions(docTexts);
      
      console.log(`Querying KG service for user ${userId} with query: "${query.substring(0, 50)}..."`);
      
      const response = await axios.post(`${kgServiceUrl}/query_kg`, {
        user_id: userId,
        query: query,
        entity_mentions: entityMentions,
        max_nodes: 15, // Limit result size
        max_edges: 30
      }, { timeout: 10000 }); // 10 second timeout
      
      if (response.data && response.data.nodes && response.data.edges) {
        console.log(`KG service returned ${response.data.nodes.length} nodes and ${response.data.edges.length} edges`);
        return response.data;
      } else {
        console.warn('KG service returned unexpected data structure:', response.data);
        return { nodes: [], edges: [] };
      }
    } catch (error) {
      console.error('Error querying Knowledge Graph service:', error.message);
      // Return empty KG data on error to allow graceful fallback
      return { nodes: [], edges: [], error: error.message };
    }
  },
  
  /**
   * Formats KG data into a text representation for inclusion in LLM context
   * @param {Object} kgData - Knowledge graph data with nodes and edges
   * @returns {string} Formatted text representation of the knowledge graph
   */
  formatKGDataForContext: (kgData) => {
    if (!kgData || !kgData.nodes || !kgData.edges || kgData.nodes.length === 0) {
      return '';
    }
    
    let formattedText = '--- Knowledge Graph Information ---\n';
    
    // Format nodes
    formattedText += 'Key Concepts:\n';
    kgData.nodes.forEach(node => {
      const description = node.description ? ` - ${node.description}` : '';
      formattedText += `• ${node.id}${description}\n`;
    });
    
    // Format edges (relationships)
    if (kgData.edges.length > 0) {
      formattedText += '\nRelationships:\n';
      kgData.edges.forEach(edge => {
        formattedText += `• ${edge.from} ${edge.relationship} ${edge.to}\n`;
      });
    }
    
    formattedText += '--- End of Knowledge Graph Information ---\n';
    return formattedText;
  }
};

/**
 * Helper function to extract potential entity mentions from text
 * This is a simple implementation - could be enhanced with NLP
 * @param {string} text - Text to extract entities from
 * @returns {Array} Array of potential entity mentions
 */
function extractEntityMentions(text) {
  if (!text) return [];
  
  // Simple approach: extract capitalized phrases that might be entities
  // This could be replaced with a more sophisticated NER approach
  const matches = text.match(/\b[A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+)*\b/g) || [];
  
  // Deduplicate and limit to reasonable number
  return [...new Set(matches)].slice(0, 20);
}
