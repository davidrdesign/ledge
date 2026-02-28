/**
 * GET /qbo/pnl
 * Returns a simplified Profit & Loss summary from QuickBooks Online.
 * Query params: start_date, end_date (YYYY-MM-DD), accounting_method (Accrual|Cash)
 */

const { qbo } = require('../../lib/qbo');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function extractRows(section) {
  if (!section) return [];
  const rows = section.Rows?.Row || [];
  return rows.map(row => {
    if (row.type === 'Section') {
      return { label: row.Header?.ColData?.[0]?.value, children: extractRows(row), total: null };
    }
    const cols = row.ColData || [];
    return {
      label:  cols[0]?.value || '',
      amount: parseFloat(cols[1]?.value || '0'),
    };
  }).filter(r => r.label);
}

function findSummaryValue(section, label) {
  if (!section) return 0;
  const summary = section.Summary?.ColData || [];
  if (summary[0]?.value?.toLowerCase().includes(label.toLowerCase())) {
    return parseFloat(summary[1]?.value || '0');
  }
  return 0;
}

module.exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    const now = new Date();
    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const today = now.toISOString().slice(0, 10);

    const params = new URLSearchParams({
      start_date:         qs.start_date || firstOfMonth,
      end_date:           qs.end_date   || today,
      accounting_method:  qs.accounting_method || 'Accrual',
    });

    const res = await qbo(`/reports/ProfitAndLoss?${params}`);
    const rows = res?.Rows?.Row || [];

    // Extract income and expenses sections
    const incomeSection  = rows.find(r => r.type === 'Section' && r.Header?.ColData?.[0]?.value?.toLowerCase().includes('income'));
    const expenseSection = rows.find(r => r.type === 'Section' && r.Header?.ColData?.[0]?.value?.toLowerCase().includes('expense'));
    const netRow         = rows.find(r => r.type === 'Section' && r.Header?.ColData?.[0]?.value?.toLowerCase().includes('net'));

    const totalIncome   = findSummaryValue(incomeSection,  'income')  || 0;
    const totalExpenses = findSummaryValue(expenseSection, 'expense') || 0;
    const netIncome     = totalIncome - totalExpenses;

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        period: {
          start: qs.start_date || firstOfMonth,
          end:   qs.end_date   || today,
        },
        summary: {
          totalIncome,
          totalExpenses,
          netIncome,
        },
        income:   extractRows(incomeSection),
        expenses: extractRows(expenseSection),
        raw:      res,
      }),
    };
  } catch (err) {
    console.error('P&L error:', err);
    return {
      statusCode: err.status || 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
