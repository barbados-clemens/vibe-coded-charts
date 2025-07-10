import { connectToDatabase, disconnectFromDatabase } from './mongo-connection';
import fs from 'fs/promises';
import path from 'path';

interface QueryOptions {
  collection: string;
  query?: any;
  aggregation?: any[];
  projection?: any;
  sort?: any;
  limit?: number;
  skip?: number;
}

export async function queryMongo(options: QueryOptions): Promise<any[]> {
  const { db } = await connectToDatabase();
  const collection = db.collection(options.collection);
  
  try {
    let results: any[];
    
    if (options.aggregation) {
      // Use aggregation pipeline
      console.log(`Running aggregation on ${options.collection}...`);
      results = await collection.aggregate(options.aggregation).toArray();
    } else {
      // Use find query
      console.log(`Running find query on ${options.collection}...`);
      let query = collection.find(options.query || {});
      
      if (options.projection) {
        query = query.project(options.projection);
      }
      
      if (options.sort) {
        query = query.sort(options.sort);
      }
      
      if (options.skip) {
        query = query.skip(options.skip);
      }
      
      if (options.limit) {
        query = query.limit(options.limit);
      }
      
      results = await query.toArray();
    }
    
    console.log(`✅ Found ${results.length} documents`);
    return results;
  } catch (error) {
    console.error(`❌ Query error:`, error);
    throw error;
  }
}

// Example queries matching your MongoDB file
export async function getTimeSavedData(
  workspaceIds: string[],
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  const aggregation = [
    {
      $match: {
        workspaceId: { $in: workspaceIds },
        date: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: {
          date: "$date",
          workspaceId: "$workspaceId"
        },
        timeSavedLocal: { $sum: "$localCacheHitDurationSavings" },
        timeSavedRemote: { $sum: "$remoteCacheHitDurationSavings" }
      }
    },
    {
      $project: {
        _id: 0,
        date: "$_id.date",
        workspaceId: "$_id.workspaceId",
        timeSaved: { $add: ["$timeSavedLocal", "$timeSavedRemote"] },
        timeSavedLocal: 1,
        timeSavedRemote: 1
      }
    },
    {
      $sort: { date: 1 }
    }
  ];
  
  return queryMongo({
    collection: 'analytics.dailyTaskStatistics',
    aggregation
  });
}

// Save query results to file
export async function saveQueryResults(
  results: any[],
  filename: string,
  directory: string = 'src/data/dumps'
): Promise<void> {
  const outputDir = path.join(process.cwd(), directory);
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputPath = path.join(outputDir, filename);
  await fs.writeFile(
    outputPath,
    JSON.stringify(results, null, 2),
    'utf-8'
  );
  
  console.log(`✅ Saved ${results.length} documents to: ${outputPath}`);
}

// Example usage script
async function runExampleQueries(): Promise<void> {
  try {
    // Example 1: Get recent workspace statistics
    const recentStats = await queryMongo({
      collection: 'analytics.dailyWorkspaceStatistics',
      query: {
        date: { $gte: new Date('2024-01-01') }
      },
      projection: {
        _id: 0,
        workspaceId: 1,
        date: 1,
        executionCredits: 1,
        runCount: 1
      },
      sort: { date: -1 },
      limit: 1000
    });
    
    await saveQueryResults(recentStats, 'recent-workspace-stats.json');
    
    // Example 2: Get time saved aggregation
    const timeSaved = await getTimeSavedData(
      ['workspace1', 'workspace2'], // Replace with actual workspace IDs
      new Date('2024-01-01'),
      new Date('2024-12-31')
    );
    
    await saveQueryResults(timeSaved, 'time-saved-aggregated.json');
    
    // Example 3: Top contributors
    const topContributors = await queryMongo({
      collection: 'analytics.dailyContributorStatistics',
      query: {},
      projection: {
        _id: 0,
        contributorName: 1,
        contributorEmail: 1,
        pipelineExecutions: 1,
        workspaceId: 1
      },
      sort: { pipelineExecutions: -1 },
      limit: 100
    });
    
    await saveQueryResults(topContributors, 'top-contributors.json');
    
  } finally {
    await disconnectFromDatabase();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExampleQueries()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export default { queryMongo, saveQueryResults, getTimeSavedData };