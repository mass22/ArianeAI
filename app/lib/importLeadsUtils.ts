/**
 * Utilitaires pour l'import de leads (parsing CSV, validation colonnes LinkedIn)
 */

/** Parse CSV file content into rows for preview (best effort, handles quoted commas) */
export async function parseCsvPreview(f: File, limit = 10): Promise<string[][]> {
  try {
    const text = await f.text()
    const lines = text.split(/\r?\n/).filter(Boolean)
    const rows: string[][] = []
    for (let i = 0; i < Math.min(limit, lines.length); i++) {
      const cells = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((c) => c.replace(/^"|"$/g, '').trim())
      rows.push(cells)
    }
    return rows
  } catch {
    return []
  }
}

/** Check if headers contain expected LinkedIn column names, return warnings */
export function checkLinkedInColumns(headers: string[]): string[] {
  const expected = ['First Name', 'Last Name', 'Email Address', 'Company', 'Position']
  const lower = headers.map((h) => h.toLowerCase())
  const missing = expected.filter((e) => !lower.some((h) => h.includes(e.toLowerCase().split(' ')[0])))
  return missing.length > 0 ? [`Colonnes LinkedIn attendues manquantes : ${missing.join(', ')}`] : []
}
