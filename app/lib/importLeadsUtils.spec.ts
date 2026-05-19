import { describe, it, expect } from 'vitest'
import { parseCsvPreview, checkLinkedInColumns } from './importLeadsUtils'

describe('importLeadsUtils', () => {
  describe('parseCsvPreview', () => {
    it('parse un CSV simple', async () => {
      const csv = 'a,b,c\n1,2,3\n4,5,6'
      const file = new File([csv], 'test.csv', { type: 'text/csv' })
      const rows = await parseCsvPreview(file)
      expect(rows).toEqual([
        ['a', 'b', 'c'],
        ['1', '2', '3'],
        ['4', '5', '6'],
      ])
    })

    it('respecte la limite par défaut (10 lignes)', async () => {
      const lines = Array.from({ length: 15 }, (_, i) => `a,b,c`)
      const file = new File([lines.join('\n')], 'test.csv', { type: 'text/csv' })
      const rows = await parseCsvPreview(file)
      expect(rows).toHaveLength(10)
    })

    it('accepte une limite personnalisée', async () => {
      const lines = Array.from({ length: 10 }, (_, i) => `a,b,c`)
      const file = new File([lines.join('\n')], 'test.csv', { type: 'text/csv' })
      const rows = await parseCsvPreview(file, 3)
      expect(rows).toHaveLength(3)
    })

    it('gère les virgules entre guillemets', async () => {
      const csv = '"Doe, John","john@example.com","Acme Corp"'
      const file = new File([csv], 'test.csv', { type: 'text/csv' })
      const rows = await parseCsvPreview(file)
      expect(rows).toEqual([['Doe, John', 'john@example.com', 'Acme Corp']])
    })

    it('retourne [] pour un fichier vide', async () => {
      const file = new File([], 'empty.csv', { type: 'text/csv' })
      const rows = await parseCsvPreview(file)
      expect(rows).toEqual([])
    })

    it('gère les fins de ligne CRLF (\\r\\n)', async () => {
      const csv = 'a,b,c\r\n1,2,3\r\n4,5,6'
      const file = new File([csv], 'test.csv', { type: 'text/csv' })
      const rows = await parseCsvPreview(file)
      expect(rows).toEqual([
        ['a', 'b', 'c'],
        ['1', '2', '3'],
        ['4', '5', '6'],
      ])
    })

    it('ignore les lignes vides', async () => {
      const csv = 'a,b,c\n\n1,2,3\n\n'
      const file = new File([csv], 'test.csv', { type: 'text/csv' })
      const rows = await parseCsvPreview(file)
      expect(rows).toEqual([
        ['a', 'b', 'c'],
        ['1', '2', '3'],
      ])
    })
  })

  describe('checkLinkedInColumns', () => {
    it('retourne [] si toutes les colonnes attendues sont présentes', () => {
      const headers = ['First Name', 'Last Name', 'Email Address', 'Company', 'Position']
      expect(checkLinkedInColumns(headers)).toEqual([])
    })

    it('accepte des noms de colonnes en minuscules', () => {
      const headers = ['first name', 'last name', 'email address', 'company', 'position']
      expect(checkLinkedInColumns(headers)).toEqual([])
    })

    it('accepte des colonnes qui contiennent le mot clé', () => {
      const headers = ['First Name (Full)', 'Last Name Here', 'Email', 'Company Name', 'Position Title']
      expect(checkLinkedInColumns(headers)).toEqual([])
    })

    it('retourne un avertissement si des colonnes manquent', () => {
      const headers = ['First Name', 'Last Name']
      expect(checkLinkedInColumns(headers)).toEqual([
        'Colonnes LinkedIn attendues manquantes : Email Address, Company, Position',
      ])
    })

    it('retourne un avertissement pour un tableau vide', () => {
      expect(checkLinkedInColumns([])).toEqual([
        'Colonnes LinkedIn attendues manquantes : First Name, Last Name, Email Address, Company, Position',
      ])
    })
  })
})
