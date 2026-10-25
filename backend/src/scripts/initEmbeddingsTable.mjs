import prisma from '../lib/prisma.js';

async function initEmbeddingsTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS species_embeddings (
        id SERIAL PRIMARY KEY,
        species_id BIGINT UNIQUE NOT NULL REFERENCES species(id) ON DELETE CASCADE,
        embedding DOUBLE PRECISION[] NOT NULL,
        content_hash VARCHAR(64) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_species_embeddings_species_id ON species_embeddings(species_id);
    `);
    console.log('✅ species_embeddings table created or verified successfully!');
  } catch (err) {
    console.error('❌ Error creating species_embeddings table:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

initEmbeddingsTable();
