const fs = require('fs');

function replaceInFile(file, regex, replacement) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(regex, replacement);
    fs.writeFileSync(file, content);
}

replaceInFile('src/pages/DryingDetail.tsx', /const isAdmin = user\?\.role === 'admin'/g, "const isAdmin = user?.role === 'admin' || user?.role === 'owner'");
replaceInFile('src/pages/BatchDetail.tsx', /const isAdmin = user\?\.role === 'admin'/g, "const isAdmin = user?.role === 'admin' || user?.role === 'owner'");
console.log('Done');
