// Database connection service - Simple Working Version
const sql = require('mssql');
const dbConfig = require('../config/database');
const logger = require('../utils/Logger');

class DatabaseService {
  constructor() {
    this.pool = null;
    this.isInitializing = false;
  }

  // Initialize connection pool
  async init() {
    if (this.isInitializing) {
      return;
    }

    this.isInitializing = true;
    
    try {
      // Close existing pool if any
      if (this.pool) {
        try {
          await this.pool.close();
        } catch (error) {
          // Ignore close errors
        }
        this.pool = null;
      }

      logger.info('Creating database connection pool...');
      
      // Create new pool
      this.pool = new sql.ConnectionPool(dbConfig.config);
      
      // Connect to the pool
      await this.pool.connect();
      
      logger.info('Database connection pool initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize database connection pool:', error);
      this.pool = null;
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  // Get pool with simple reconnection
  async getPool() {
    // If no pool or not connected, initialize
    if (!this.pool || !this.pool.connected) {
      logger.info('Database pool not available, initializing...');
      await this.init();
    }
    
    return this.pool;
  }

  // Execute query with simple retry
  async executeQuery(query, params = []) {
    let attempt = 0;
    const maxAttempts = 2;
    
    while (attempt < maxAttempts) {
      try {
        const pool = await this.getPool();
        const request = pool.request();
        
        // Add parameters to the request
        if (params && params.length > 0) {
          params.forEach(param => {
            request.input(param.name, param.type, param.value);
          });
        }
        
        // Execute the query
        const result = await request.query(query);
        return result;
        
      } catch (error) {
        attempt++;
        logger.error(`Database query error (attempt ${attempt}):`, error);
        
        // If connection error and not last attempt, reset pool
        if (attempt < maxAttempts && this.isConnectionError(error)) {
          logger.warn('Connection error, resetting pool...');
          this.pool = null;
          
          // Wait a bit before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        // Last attempt or non-connection error, throw
        throw error;
      }
    }
  }

  // Execute stored procedure with simple retry
  async executeStoredProcedure(procedureName, params = []) {
    let attempt = 0;
    const maxAttempts = 2;
    
    while (attempt < maxAttempts) {
      try {
        const pool = await this.getPool();
        const request = pool.request();
        
        // Add parameters to the request
        if (params && params.length > 0) {
          params.forEach(param => {
            if (param.direction === 'OUTPUT') {
              request.output(param.name, param.type);
            } else {
              request.input(param.name, param.type, param.value);
            }
          });
        }
        
        // Execute the stored procedure
        const result = await request.execute(procedureName);
        return result;
        
      } catch (error) {
        attempt++;
        logger.error(`Error executing stored procedure ${procedureName} (attempt ${attempt}):`, error);
        
        // If connection error and not last attempt, reset pool
        if (attempt < maxAttempts && this.isConnectionError(error)) {
          logger.warn('Connection error, resetting pool...');
          this.pool = null;
          
          // Wait a bit before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        throw error;
      }
    }
  }

  // Helper method for transactions
  async transaction(callback) {
    const pool = await this.getPool();
    const transaction = new sql.Transaction(pool);
    
    try {
      await transaction.begin();
      const result = await callback(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error('Error rolling back transaction:', rollbackError);
      }
      logger.error('Transaction error:', error);
      throw error;
    }
  }

  // Check if error is connection-related
  isConnectionError(error) {
    const connectionErrors = [
      'ECONNCLOSED',
      'ECONNRESET', 
      'ENOTOPEN',
      'ENOTCONNECTED'
    ];
    
    return connectionErrors.includes(error.code) || 
           error.message.includes('Connection is closed') ||
           error.message.includes('connection') ||
           error.message.includes('closed');
  }
}

// Create a singleton instance
const dbService = new DatabaseService();

module.exports = dbService;