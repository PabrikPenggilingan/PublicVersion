const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, '../src/models');
const servicesDir = path.join(__dirname, '../src/services');
const controllersDir = path.join(__dirname, '../src/controllers');

// The mapping of table names to their new schema-qualified names
const tableMap = {
    // sys
    'users': 'sys.users',
    'wizard_states': 'sys.wizard_states',
    'upload_intents': 'sys.upload_intents',
    'config': 'sys.config',

    // mst
    'item_categories': 'mst.item_categories',
    'item_products': 'mst.item_products',

    // log
    'log_history': 'log.activity', // Renamed table!

    // trx
    'batches': 'trx.batches',
    'purchases': 'trx.purchases',
    'processes': 'trx.processes',
    'process_batches': 'trx.process_batches',
    'drying_processes': 'trx.drying_processes',
    'drying_sessions': 'trx.drying_sessions',
    'drying_batches': 'trx.drying_batches',
    'drying_links': 'trx.drying_links',
    'drying_photos': 'trx.drying_photos',
    'batch_links': 'trx.batch_links',
    'batch_completions': 'trx.batch_completions',
    'purchase_photos': 'trx.purchase_photos',
    'inventory_items': 'trx.inventory_items',
    'inventory_sacks': 'trx.inventory_sacks',
    'inventory_transactions': 'trx.inventory_transactions',
    'sales_beras': 'trx.sales_beras',
    'sales_dedak': 'trx.sales_dedak',
    'sales_sekam': 'trx.sales_sekam',
    'sales_menir': 'trx.sales_menir',
    'sales_broken': 'trx.sales_broken',
    'files': 'trx.files',
    'pendataan_gabah': 'trx.pendataan_gabah',
    'submission_counts': 'trx.submission_counts'
};

function processDirectory(directory) {
    const files = fs.readdirSync(directory);
    let changedFiles = 0;

    for (const file of files) {
        if (!file.endsWith('.js')) continue;

        const filePath = path.join(directory, file);
        let content = fs.readFileSync(filePath, 'utf8');
        let originalContent = content;

        // Keywords that typically precede a table name in our SQL queries
        const keywords = ['FROM', 'JOIN', 'INTO', 'UPDATE', 'TABLE'];

        // Build a regex to match: (Keyword) (table_name)
        // Note: we use negative lookbehinds/lookaheads or just word boundaries to avoid double replacement
        // e.g. "FROM batches" -> "FROM trx.batches"
        for (const [oldName, newName] of Object.entries(tableMap)) {
            for (const kw of keywords) {
                // Regex matches the keyword, optional spaces, and the EXACT old table name.
                // It ensures there's no dot right before the table name (to prevent 'trx.trx.batches')
                // and it ensures it matches a whole word.
                const regex = new RegExp(`\\b(${kw})\\s+(?!\\w+\\.)${oldName}\\b`, 'g');
                content = content.replace(regex, `$1 ${newName}`);
            }
        }

        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Updated: ${filePath}`);
            changedFiles++;
        }
    }
    return changedFiles;
}

console.log('Starting backend schema refactoring...');
let total = 0;
total += processDirectory(modelsDir);
total += processDirectory(servicesDir);
total += processDirectory(controllersDir);
console.log(`\nRefactoring complete! Updated ${total} files.`);
