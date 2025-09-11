import { useState, useEffect } from 'react'
import { useScreenSize } from './use-screen-size'

export interface PhoneModeConfig {
  isPhoneMode: boolean
  setPhoneMode: (enabled: boolean) => void
  canUsePhoneMode: boolean
  autoSuggestPhoneMode: boolean
}

export function usePhoneMode(): PhoneModeConfig {
  const { isMobile, dimensions } = useScreenSize()
  
  // Déterminer si l'appareil peut bénéficier du mode téléphone
  const canUsePhoneMode = isMobile || dimensions.width <= 480
  
  // Auto-suggestion pour très petits écrans (< 400px)
  const autoSuggestPhoneMode = dimensions.width < 400
  
  const [isPhoneMode, setIsPhoneMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('phoneMode')
      if (saved !== null) {
        return JSON.parse(saved)
      }
      
      // Auto-activation pour très petits écrans
      if (autoSuggestPhoneMode) {
        return true
      }
      
      return false
    } catch (error) {
      console.error('Error reading phone mode from localStorage:', error)
      return autoSuggestPhoneMode
    }
  })

  const setPhoneMode = (enabled: boolean) => {
    setIsPhoneMode(enabled)
    try {
      localStorage.setItem('phoneMode', JSON.stringify(enabled))
      console.log('📱 Phone mode preference saved:', enabled)
    } catch (error) {
      console.error('Error saving phone mode to localStorage:', error)
    }
  }

  // Effect pour activer automatiquement le mode téléphone selon la largeur
  useEffect(() => {
    const saved = localStorage.getItem('phoneMode')
    if (saved !== null) return // L'utilisateur a une préférence explicite, ne pas override
    
    const shouldEnable = dimensions.width < 400
    if (isPhoneMode !== shouldEnable) {
      console.log('📱 Auto-toggling phone mode:', { 
        width: dimensions.width, 
        shouldEnable, 
        currentMode: isPhoneMode 
      })
      setIsPhoneMode(shouldEnable)
    }
  }, [dimensions.width, isPhoneMode])

  // Effect pour logger les changements de mode
  useEffect(() => {
    console.log('📱 Phone mode state:', {
      isPhoneMode,
      canUsePhoneMode,
      autoSuggestPhoneMode,
      screenWidth: dimensions.width,
      isMobile
    })
  }, [isPhoneMode, canUsePhoneMode, autoSuggestPhoneMode, dimensions.width, isMobile])

  return {
    isPhoneMode,
    setPhoneMode,
    canUsePhoneMode,
    autoSuggestPhoneMode
  }
}