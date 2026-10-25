import vectorSearchService from '../services/vectorSearchService.js';
import prisma from '../lib/prisma.js';

async function main() {
  console.log('--- STARTING VECTOR EMBEDDINGS SYNC ---');
  await vectorSearchService.syncAllSpeciesEmbeddings();
  console.log('--- VECTOR EMBEDDINGS SYNC FINISHED ---');
  await prisma.$disconnect();
}

main().catch(console.error);
