import * as fs from 'fs';
import * as path from 'path';
import { calculateCIPEMetrics, MinimalCIPE, PipelineMetrics } from '../src/utils/pipelineMetrics';

// Example of how to use the calculateCIPEMetrics utility
function main() {
  // Load the actual data
  const dataPath = path.join(__dirname, '../src/data/dumps/ci-pipeline-executions.json');
  const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  
  // Transform to minimal CIPE format
  const minimalCipes: MinimalCIPE[] = rawData.map((execution: any) => ({
    createdAt: execution.createdAt,
    completedAt: execution.completedAt,
    status: execution.status
  }));
  
  // Calculate metrics
  const metrics: PipelineMetrics = calculateCIPEMetrics(minimalCipes);
  
  // Display results
  console.log('=== Pipeline Metrics ===');
  console.log(`Total completed executions: ${metrics.overall.count}`);
  console.log(`Overall P50: ${Math.round(metrics.overall.p50 / 1000)}s`);
  console.log(`Overall P95: ${Math.round(metrics.overall.p95 / 1000)}s`);
  console.log(`Overall Median: ${Math.round(metrics.overall.median / 1000)}s`);
  
  console.log('\n=== Weekly Breakdown ===');
  Object.keys(metrics.weekly).sort().forEach(weekKey => {
    const stats = metrics.weekly[weekKey];
    console.log(`${weekKey}: ${stats.count} executions, P50: ${Math.round(stats.p50 / 1000)}s, P95: ${Math.round(stats.p95 / 1000)}s, Median: ${Math.round(stats.median / 1000)}s`);
  });
}

main();