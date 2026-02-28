/**
 * GET /inventory
 * Returns inventory levels from CartRover, merged with product info,
 * mapped to Ledge's inventory item shape.
 */
const { cartrover } = require('../lib/cartrover');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

function getStatus(qty, reorder) {
  if (qty <= 0)            return 'crit';
  if (qty <= reorder)      return 'low';
  return 'ok';
}

function mapInventoryItem(item) {
  const qty     = parseInt(item.quantity_on_hand ?? item.qty ?? 0, 10);
  const reorder = parseInt(item.reorder_point    ?? item.reorder ?? 0, 10);
  return {
    id:          item.product_id || item.id,
    sku:         item.sku,
    name:        item.product_name || item.name || item.sku,
    cat:         item.category || 'Uncategorised',
    qty,
    reorder,
    cost:        parseFloat(item.unit_cost || item.cost || 0),
    warehouse:   item.warehouse_name || item.warehouse || 'Default',
    status:      getStatus(qty, reorder),
    uom:         item.unit_of_measure || item.uom || 'Each',
    uomAlts:     [],
    autoReorder: item.auto_reorder ?? false,
    history:     item.history || [],
    lastReceived: item.last_received_date || null,
    leadTime:    item.lead_time_days ?? null,
    bin:         item.bin_location || item.bin || null,
    // warehouse breakdown (added in recent CartRover update)
    warehouses:  item.warehouses || [],
  };
}

module.exports.handler = async () => {
  try {
    const data = await cartrover('/v1/merchant/inventory');
    const items = Array.isArray(data) ? data : (data.inventory || data.items || [data]);
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify(items.map(mapInventoryItem)),
    };
  } catch (err) {
    console.error('inventory error:', err);
    return {
      statusCode: err.status || 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message, code: err.errorCode }),
    };
  }
};
