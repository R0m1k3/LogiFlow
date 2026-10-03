import { useState, useEffect } from 'react'

export type ScreenSize = 'mobile' | 'tablet' | 'desktop'

export interface ScreenBreakpoints {
  mobile: number
  tablet: number
  desktop: number
}

const defaultBreakpoints: ScreenBreakpoints = {
  mobile: 768,
  tablet: 1024,
  desktop: 1280
}

const getScreenSize = (width: number, breakpoints: ScreenBreakpoints): ScreenSize => {
  if (width < breakpoints.mobile) return 'mobile'
  if (width <= breakpoints.tablet) return 'tablet' // Inclut 1024px comme tablette
  return 'desktop'
}

export function useScreenSize(breakpoints: ScreenBreakpoints = defaultBreakpoints) {
  // Palier calculé dès le premier rendu (pas de passage transitoire par 'desktop')
  const [screenSize, setScreenSize] = useState<ScreenSize>(() =>
    typeof window !== 'undefined' ? getScreenSize(window.innerWidth, breakpoints) : 'desktop'
  )

  useEffect(() => {
    // Seul le palier est stocké : setScreenSize avec la même valeur ne provoque
    // pas de re-rendu, donc l'arbre n'est re-rendu que lorsque le palier change
    // et non à chaque pixel de redimensionnement
    const updateScreenSize = () => {
      setScreenSize(getScreenSize(window.innerWidth, breakpoints))
    }

    // Set initial values
    updateScreenSize()

    // Add event listener
    window.addEventListener('resize', updateScreenSize)

    // Cleanup
    return () => window.removeEventListener('resize', updateScreenSize)
  }, [breakpoints])

  // Dimensions lues au moment du rendu (non stockées dans l'état pour ne pas
  // re-rendre à chaque redimensionnement)
  const dimensions = {
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  }

  return {
    screenSize,
    dimensions,
    isMobile: screenSize === 'mobile',
    isTablet: screenSize === 'tablet',
    isDesktop: screenSize === 'desktop',
    isMobileOrTablet: screenSize === 'mobile' || screenSize === 'tablet',
    isTabletOrDesktop: screenSize === 'tablet' || screenSize === 'desktop'
  }
}
