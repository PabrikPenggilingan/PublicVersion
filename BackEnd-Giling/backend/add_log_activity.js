const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'src', 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.routes.js'));

files.forEach(file => {
    const filePath = path.join(routesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Skip if it already has logActivity
    if (content.includes('logActivity')) return;
    
    // Check if it has any POST/PUT/DELETE routes
    if (!/router\.(post|put|delete)/.test(content)) return;

    // Add imports
    const importLogActivity = `const { logActivity } = require('../middleware/logActivity');\nconst { LOG_ACTIONS } = require('../utils/constants');\n`;
    
    // Find the last require
    const requireMatches = [...content.matchAll(/require\([^)]+\);?/g)];
    if (requireMatches.length > 0) {
        const lastRequire = requireMatches[requireMatches.length - 1];
        const lastRequireEndIndex = lastRequire.index + lastRequire[0].length;
        content = content.slice(0, lastRequireEndIndex) + '\n' + importLogActivity + content.slice(lastRequireEndIndex);
    } else {
        content = importLogActivity + '\n' + content;
    }

    // Replace router methods
    const moduleName = file.replace('.routes.js', '');
    
    content = content.replace(/router\.post\((['"`][^'"`]+['"`]),\s*/g, `router.post($1, logActivity(LOG_ACTIONS.CREATE, '${moduleName}'), `);
    content = content.replace(/router\.put\((['"`][^'"`]+['"`]),\s*/g, `router.put($1, logActivity(LOG_ACTIONS.UPDATE, '${moduleName}'), `);
    content = content.replace(/router\.delete\((['"`][^'"`]+['"`]),\s*/g, `router.delete($1, logActivity(LOG_ACTIONS.DELETE, '${moduleName}'), `);

    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
});
