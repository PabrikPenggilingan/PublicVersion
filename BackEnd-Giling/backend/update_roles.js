const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'src', 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.routes.js'));

let updatedFiles = 0;

files.forEach(file => {
    const filePath = path.join(routesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    let original = content;

    // Replace requireRole('admin') with requireRole('admin', 'operator')
    // and handle spaces appropriately
    content = content.replace(/requireRole\(['"`]admin['"`]\)/g, "requireRole('admin', 'operator')");
    
    // Replace requireRole(USER_ROLES.ADMIN) with requireRole(USER_ROLES.ADMIN, USER_ROLES.OPERATOR)
    content = content.replace(/requireRole\(USER_ROLES\.ADMIN\)/g, "requireRole(USER_ROLES.ADMIN, USER_ROLES.OPERATOR)");

    if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${file}`);
        updatedFiles++;
    }
});

console.log(`Total files updated: ${updatedFiles}`);
