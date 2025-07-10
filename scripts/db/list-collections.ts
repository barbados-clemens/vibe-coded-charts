import { connectToDatabase, disconnectFromDatabase } from './mongo-connection';

async function listCollections() {
  try {
    const { db } = await connectToDatabase();
    
    console.log('📋 Listing all collections in the database:\n');
    
    const collections = await db.listCollections().toArray();
    
    for (const collection of collections) {
      console.log(`  • ${collection.name}`);
      
      // Get document count
      const count = await db.collection(collection.name).countDocuments();
      console.log(`    Documents: ${count}`);
      
      // Get a sample document
      const sample = await db.collection(collection.name).findOne();
      if (sample) {
        console.log(`    Sample fields: ${Object.keys(sample).join(', ')}`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('Error listing collections:', error);
  } finally {
    await disconnectFromDatabase();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  listCollections()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}