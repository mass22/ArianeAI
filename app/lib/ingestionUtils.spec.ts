import { describe, it, expect } from 'vitest'
import { parseUrlsFromText, normalizeLinkedinUrls, normalizeIngestionError } from './ingestionUtils'

describe('ingestionUtils', () => {
  describe('parseUrlsFromText', () => {
    it('parse une chaîne avec retours à la ligne', () => {
      const text = 'https://a.com\nhttps://b.com\nhttps://c.com'
      expect(parseUrlsFromText(text)).toEqual(['https://a.com', 'https://b.com', 'https://c.com'])
    })

    it('parse une chaîne avec virgules et point-virgules', () => {
      const text = 'https://a.com, https://b.com; https://c.com'
      expect(parseUrlsFromText(text)).toEqual(['https://a.com', 'https://b.com', 'https://c.com'])
    })

    it('trim les espaces et filtre les chaînes vides', () => {
      const text = '  https://a.com  \n\n  https://b.com  \n  '
      expect(parseUrlsFromText(text)).toEqual(['https://a.com', 'https://b.com'])
    })

    it('retourne [] pour une chaîne vide', () => {
      expect(parseUrlsFromText('')).toEqual([])
      expect(parseUrlsFromText('   \n\n  ')).toEqual([])
    })
  })

  describe('normalizeLinkedinUrls', () => {
    it('accepte les URLs LinkedIn valides', () => {
      const urls = [
        'https://linkedin.com/in/john-doe',
        'https://www.linkedin.com/in/jane',
        'https://fr.linkedin.com/in/marie-dupont',
      ]
      expect(normalizeLinkedinUrls(urls)).toEqual(urls)
    })

    it('filtre les URLs non-LinkedIn', () => {
      const input = [
        'https://linkedin.com/in/valid',
        'https://example.com/page',
        'https://linkedin.com/company/foo',
      ]
      expect(normalizeLinkedinUrls(input)).toEqual(['https://linkedin.com/in/valid'])
    })

    it('parse une chaîne avec séparateurs (nouvelles lignes, virgules, point-virgules)', () => {
      const input = 'https://linkedin.com/in/a\nhttps://linkedin.com/in/b,https://linkedin.com/in/c;https://linkedin.com/in/d'
      expect(normalizeLinkedinUrls(input)).toEqual([
        'https://linkedin.com/in/a',
        'https://linkedin.com/in/b',
        'https://linkedin.com/in/c',
        'https://linkedin.com/in/d',
      ])
    })

    it('ignore les valeurs vides et trim les espaces', () => {
      const input = ['  https://linkedin.com/in/x  ', '', '  ', 'https://linkedin.com/in/y']
      expect(normalizeLinkedinUrls(input)).toEqual([
        'https://linkedin.com/in/x',
        'https://linkedin.com/in/y',
      ])
    })

    it('retourne un tableau vide si aucune URL valide', () => {
      expect(normalizeLinkedinUrls([])).toEqual([])
      expect(normalizeLinkedinUrls('')).toEqual([])
      expect(normalizeLinkedinUrls(['https://google.com', ''])).toEqual([])
    })

    it('accepte les URLs avec paramètres de requête', () => {
      const input = 'https://linkedin.com/in/john?locale=fr_FR'
      expect(normalizeLinkedinUrls(input)).toEqual([input])
    })

    it('accepte les URLs sans protocole (texte brut)', () => {
      const input = 'linkedin.com/in/john-doe'
      expect(normalizeLinkedinUrls(input)).toEqual([input])
    })
  })

  describe('normalizeIngestionError', () => {
    it('retourne Erreur inconnue pour null/undefined', () => {
      expect(normalizeIngestionError(null)).toBe('Erreur inconnue')
      expect(normalizeIngestionError(undefined)).toBe('Erreur inconnue')
    })

    it('traite les erreurs timeout (code 408)', () => {
      expect(normalizeIngestionError({ statusCode: 408 })).toBe("Délai d'attente dépassé. Réessayez.")
      expect(normalizeIngestionError({ message: 'Request timeout' })).toBe("Délai d'attente dépassé. Réessayez.")
    })

    it('traite les erreurs réseau', () => {
      expect(normalizeIngestionError({ status: 0 })).toBe('Serveur inaccessible. Vérifiez votre connexion.')
      expect(normalizeIngestionError({ message: 'Failed to fetch' })).toBe(
        'Serveur inaccessible. Vérifiez votre connexion.',
      )
      expect(normalizeIngestionError({ message: 'Network error' })).toBe(
        'Serveur inaccessible. Vérifiez votre connexion.',
      )
    })

    it('retourne le message direct si présent et non spécial', () => {
      expect(normalizeIngestionError({ message: 'Email invalide' })).toBe('Email invalide')
      expect(normalizeIngestionError({ data: { message: 'CSV mal formé' } })).toBe('CSV mal formé')
    })

    it('retourne Erreur lors de l\'import en fallback', () => {
      expect(normalizeIngestionError({})).toBe("Erreur lors de l'import")
    })

    it('préfère data.message au message direct pour les erreurs API', () => {
      const err = { message: 'Generic', data: { message: 'Email invalide à la ligne 5' } }
      expect(normalizeIngestionError(err)).toBe('Email invalide à la ligne 5')
    })

    it('gère les erreurs avec statusCode 500 et message serveur', () => {
      expect(normalizeIngestionError({ statusCode: 500, data: { message: 'Erreur interne' } })).toBe(
        'Erreur interne',
      )
    })

    it('retourne le fallback pour un objet sans message utile', () => {
      expect(normalizeIngestionError({ data: {} })).toBe("Erreur lors de l'import")
    })
  })
})
