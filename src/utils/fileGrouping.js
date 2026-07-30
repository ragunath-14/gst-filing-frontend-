const MONTH_ORDER = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Default section ordering when a filing type isn't one of the company's
// subscribed return services (those always come first, in their configured order).
const FILING_TYPE_ORDER = ['GSTR-1', 'GSTR-3B', 'GSTR-2A', 'GSTR-9', 'GSTR-9C', 'CMP-08', 'Other'];

export function parsePeriod(filingPeriod) {
  if (!filingPeriod) return { month: 'Unspecified', year: 'Unspecified' };
  const parts = filingPeriod.trim().split(' ');
  return { month: parts[0] || 'Unspecified', year: parts[1] || 'Unspecified' };
}

// Shared grouping logic behind groupFilesByYearTypeMonth and
// groupFilesByFinancialYearTypeMonth below — only how the top-level "year"
// key is derived from a file differs between the two.
function groupFilesByKeyTypeMonth(files, returnServices, getYearKey) {
  const byYear = {};
  for (const f of files) {
    const { month } = parsePeriod(f.filingPeriod);
    const year = getYearKey(f);
    const type = f.filingType || 'Other';
    if (!byYear[year]) byYear[year] = {};
    if (!byYear[year][type]) byYear[year][type] = {};
    if (!byYear[year][type][month]) byYear[year][type][month] = [];
    byYear[year][type][month].push(f);
  }

  const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  const typeRank = (type) => {
    const subscribedIdx = returnServices.indexOf(type);
    if (subscribedIdx !== -1) return subscribedIdx;
    const defaultIdx = FILING_TYPE_ORDER.indexOf(type);
    return returnServices.length + (defaultIdx === -1 ? FILING_TYPE_ORDER.length : defaultIdx);
  };

  return years.map(year => ({
    year,
    types: Object.keys(byYear[year])
      .sort((a, b) => typeRank(a) - typeRank(b))
      .map(type => ({
        filingType: type,
        months: Object.keys(byYear[year][type])
          .sort((a, b) => MONTH_ORDER.indexOf(b) - MONTH_ORDER.indexOf(a))
          .map(month => ({ month, files: byYear[year][type][month] }))
      }))
  }));
}

// Groups files into Year -> Filing Type -> Month sections, so each return
// service (GSTR-1, GSTR-3B, ...) the company is subscribed to gets its own
// month-wise archive within a filing year. Subscribed services are listed
// first (in the order the company configured them); any other filing type
// present in the files (e.g. GSTR-2A, CMP-08) still gets its own section
// afterwards rather than being dropped. Newest year and month first.
export function groupFilesByYearTypeMonth(files, returnServices = []) {
  return groupFilesByKeyTypeMonth(files, returnServices, f => parsePeriod(f.filingPeriod).year);
}

// Same Year -> Filing Type -> Month structure, but keyed on the GST financial
// year (e.g. "2026-27") already stored on each file, rather than the calendar
// year parsed from filingPeriod — matches how GST returns are actually filed.
export function groupFilesByFinancialYearTypeMonth(files, returnServices = []) {
  return groupFilesByKeyTypeMonth(files, returnServices, f => f.financialYear || 'Unspecified');
}
