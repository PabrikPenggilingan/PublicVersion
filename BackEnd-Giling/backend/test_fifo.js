const db = require('./src/config/database');
const requestContext = require('./src/config/context');
const inventoryItemsModel = require('./src/models/inventoryItem.model');

async function test() {
    await requestContext.run({ user: { id: '0ac4a865-faea-43ed-96a2-ff2deb112d8c', role: 'owner' } }, async () => {
        const res = await inventoryItemsModel.findAvailableFIFO(2000);
        console.log(res.filter(i => i.product_category_code === 'GABAH_KERING' || i.product_category_code === 'GABAH_BASAH'));
    });
    process.exit(0);
}
test();
