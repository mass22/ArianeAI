import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { addDays, diffInDays, formatDateDisplay, getFollowupType, getScheduledFollowupType, todayMontreal } from './dateUtils'

describe('dateUtils', () => {
  describe('addDays', () => {
    it('ajoute des jours à une date au format YYYY-MM-DD', () => {
      expect(addDays('2025-02-15', 0)).toBe('2025-02-15')
      expect(addDays('2025-02-15', 4)).toBe('2025-02-19')
      expect(addDays('2025-02-15', 10)).toBe('2025-02-25')
    })

    it('gère le changement de mois', () => {
      expect(addDays('2025-02-28', 4)).toBe('2025-03-04')
    })

    it('gère le changement d\'année', () => {
      expect(addDays('2025-12-30', 5)).toBe('2026-01-04')
    })
  })

  describe('formatDateDisplay', () => {
    it('affiche correctement les dates au format YYYY-MM-DD sans décalage (date calendaire)', () => {
      const result = formatDateDisplay('2026-02-18')
      expect(result).toMatch(/18/) // Le jour doit être 18, pas 17 (bug UTC)
      expect(result).toMatch(/02/) // Février
    })

    it('retourne — pour null/undefined/vide', () => {
      expect(formatDateDisplay(null)).toBe('—')
      expect(formatDateDisplay(undefined)).toBe('—')
      expect(formatDateDisplay('')).toBe('—')
    })
  })

  describe('todayMontreal', () => {
    const fixedDate = new Date('2025-02-15T14:30:00-05:00') // America/Montreal

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(fixedDate)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('retourne la date du jour au format YYYY-MM-DD en America/Montreal', () => {
      expect(todayMontreal()).toBe('2025-02-15')
    })
  })

  describe('diffInDays', () => {
    it('calcule la différence en jours entre deux dates', () => {
      expect(diffInDays('2025-02-19', '2025-02-15')).toBe(4)
      expect(diffInDays('2025-02-15', '2025-02-19')).toBe(-4)
      expect(diffInDays('2025-02-15', '2025-02-15')).toBe(0)
    })
  })

  describe('getFollowupType', () => {
    it('retourne j4 quand last_touch + 4 jours = target', () => {
      expect(getFollowupType('2025-02-11', '2025-02-15', '2025-02-15')).toBe('j4')
    })
    it('retourne j10 quand last_touch + 6 jours = target (après J+4 envoyé)', () => {
      expect(getFollowupType('2025-02-09', '2025-02-15', '2025-02-15')).toBe('j10')
    })
    it('retourne null si next_followup ne correspond pas à la target', () => {
      expect(getFollowupType('2025-02-11', '2025-02-16', '2025-02-15')).toBe(null)
    })
    it('retourne null si last_touch manquant', () => {
      expect(getFollowupType(null, '2025-02-15', '2025-02-15')).toBe(null)
    })
  })

  describe('getScheduledFollowupType', () => {
    it('retourne j4 pour intervalle 4 jours', () => {
      expect(getScheduledFollowupType('2025-02-11', '2025-02-15')).toBe('j4')
    })
    it('retourne j10 pour intervalle 6 jours', () => {
      expect(getScheduledFollowupType('2025-02-09', '2025-02-15')).toBe('j10')
    })
    it('retourne null pour intervalle hors plage', () => {
      expect(getScheduledFollowupType('2025-02-01', '2025-02-15')).toBe(null)
    })
  })
})
