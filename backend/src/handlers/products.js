/**
 * GET /products
 * Returns product catalogue from CartRover, mapped to Ledge's inventory item shape.
 */
const { cartrover } = require('../lib/cartrover');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

function mapProduct(p) {
  return {
    id:          p.product_id || p.id,
    sku:         p.sku,
    name:        p.product_name || p.name,
    cat:         p.category || 'Uncategorised',
    cost:        parseFloat(p.unit_cost || p.cost || 0),
    uom:         p.unit_of_measure || p.uom || 'Each',
    uomAlts:     [],
    autoReorder: p.auto_reorder ?? false,
    weight:      p.weight,
    description: p.description,
  };
}

module.exports.handler = async () => {
  try {
    const data = await cartrover('/v1/merchant/product');
    const products = Array.isArray(data) ? data : (data.products || data.items || [data]);
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify(products.map(mapProduct)),
    };
  } catch (err) {
    console.error('products error:', err);
    return {
      statusCode: err.status || 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message, code: err.errorCode }),
    };
  }
};
