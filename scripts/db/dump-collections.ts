import { connectToDatabase, disconnectFromDatabase } from './mongo-connection';
import fs from 'fs/promises';
import path from 'path';

interface DumpConfig {
  collection: string;
  outputFile: string;
  dateField: string;
  query?: any;
  projection?: any;
  sort?: any;
}

// Get date 90 days ago by default
const getDateCutoff = (days: number = 90): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
};

const DUMP_CONFIGS: DumpConfig[] = [
  {
    collection: 'billing.workspaceCreditUsage',
    outputFile: 'workspace-credit-usage.json',
    dateField: 'date',
    projection: {
      _id: 0
    },
    sort: { date: -1 }
  },
  {
    collection: 'analytics.dailyTaskStatistics',
    outputFile: 'task-statistics.json',
    dateField: 'date',
    projection: {
      _id: 0
    },
    sort: { date: -1 }
  },
  {
    collection: 'analytics.dailyOrganizationContributors',
    outputFile: 'organization-contributors.json',
    dateField: 'date',
    projection: {
      _id: 0
    },
    sort: { date: -1 }
  },
  {
    collection: 'analytics.dailyWorkspaceRunCounts',
    outputFile: 'workspace-run-counts.json',
    dateField: 'date',
    projection: {
      _id: 0
    },
    sort: { date: -1 }
  },
  {
    collection: 'contributors',
    outputFile: 'contributors.json',
    dateField: 'createdAt',
    projection: {
      _id: 0
    },
    sort: { createdAt: -1 }
  },
  {
    collection: 'runs',
    outputFile: 'runs.json',
    dateField: 'createdAt',
    query: {
      inner: { $ne: true },
      branch: { $exists: true, $ne: null, $ne: '' }
    },
    projection: {
      _id: 0,
      workspaceId: 1,
      command: 1,
      startTime: 1,
      endTime: 1,
      status: 1,
      tasks: 1,
      branch: 1,
      sha: 1,
      createdAt: 1
    },
    sort: { createdAt: -1 }
  },
  {
    collection: 'ciPipelineExecutions',
    outputFile: 'ci-pipeline-executions.json',
    dateField: 'createdAt',
    projection: {
      _id: 0
    },
    sort: { createdAt: -1 }
  }
];

async function dumpCollection(config: DumpConfig, dateCutoff: Date): Promise<void> {
  const { db } = await connectToDatabase();
  
  // Special handling for runs collection - always use 3 days
  let effectiveDateCutoff = dateCutoff;
  if (config.collection === 'runs') {
    effectiveDateCutoff = getDateCutoff(3);
    console.log(`\n📊 Dumping collection: ${config.collection}`);
    console.log(`   ⚠️  Runs collection always uses 3-day limit`);
    console.log(`   Using date cutoff: ${effectiveDateCutoff.toISOString()} (${config.dateField})`);
  } else {
    console.log(`\n📊 Dumping collection: ${config.collection}`);
    console.log(`   Using date cutoff: ${effectiveDateCutoff.toISOString()} (${config.dateField})`);
  }
  
  try {
    const collection = db.collection(config.collection);
    
    // Build query with date cutoff
    const query = {
      ...config.query,
      [config.dateField]: { $gte: effectiveDateCutoff }
    };
    
    let cursor = collection.find(query);
    
    if (config.projection) {
      cursor = cursor.project(config.projection);
    }
    
    if (config.sort) {
      cursor = cursor.sort(config.sort);
    }
    
    const documents = await cursor.toArray();
    
    console.log(`  ✅ Found ${documents.length} documents since ${effectiveDateCutoff.toLocaleDateString()}`);
    
    // Ensure output directory exists
    const outputDir = path.join(process.cwd(), 'src', 'data', 'dumps');
    await fs.mkdir(outputDir, { recursive: true });
    
    // Write to file
    const outputPath = path.join(outputDir, config.outputFile);
    await fs.writeFile(
      outputPath,
      JSON.stringify(documents, null, 2),
      'utf-8'
    );
    
    console.log(`  ✅ Saved to: ${outputPath}`);
    
    // Also create a TypeScript file with sample data structure
    if (documents.length > 0) {
      const samplePath = path.join(outputDir, `sample-${config.outputFile.replace('.json', '.ts')}`);
      const sampleContent = `// Sample data structure from ${config.collection}
// Date field: ${config.dateField}
export const sample = ${JSON.stringify(documents[0], null, 2)};

export type ${config.outputFile.replace('.json', '').replace(/-/g, '_')}Type = typeof sample;
`;
      await fs.writeFile(samplePath, sampleContent, 'utf-8');
    }
    
  } catch (error) {
    console.error(`  ❌ Error dumping ${config.collection}:`, error);
    throw error;
  }
}

async function dumpAllCollections(days?: number): Promise<void> {
  const dateCutoff = getDateCutoff(days);
  console.log('🚀 Starting MongoDB collection dumps...');
  console.log(`📅 Date cutoff: ${dateCutoff.toISOString()} (last ${days || 90} days)\n`);
  
  try {
    for (const config of DUMP_CONFIGS) {
      await dumpCollection(config, dateCutoff);
    }
    
    console.log('\n✅ All collections dumped successfully!');
  } catch (error) {
    console.error('\n❌ Error during dump process:', error);
    throw error;
  } finally {
    await disconnectFromDatabase();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Parse days from command line argument
  const days = process.argv[2] ? parseInt(process.argv[2], 10) : 90;
  
  dumpAllCollections(days)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { dumpAllCollections, dumpCollection };