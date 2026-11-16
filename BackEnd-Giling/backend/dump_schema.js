const db = require('./src/config/database');
const fs = require('fs');

async function getSchema() {
  const query = `
    SELECT 
      t.table_schema, 
      t.table_name, 
      c.column_name, 
      c.data_type,
      tc.constraint_type,
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.tables t
    JOIN information_schema.columns c ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    LEFT JOIN information_schema.key_column_usage kcu ON t.table_schema = kcu.table_schema AND t.table_name = kcu.table_name AND c.column_name = kcu.column_name
    LEFT JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    LEFT JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE t.table_schema IN ('trx', 'mst', 'auth', 'public') AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_schema, t.table_name, c.ordinal_position;
  `;
  const result = await db.query(query);
  fs.writeFileSync('schema_dump.json', JSON.stringify(result.rows, null, 2));
  console.log('Schema dumped successfully');
  process.exit(0);
}

getSchema().catch(e => { console.error(e); process.exit(1); });
