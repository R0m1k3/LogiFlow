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

export function useScreenSize(breakpoints: ScreenBreakpoints = defaultBreakpoints) {
  const [screenSize, setScreenSize] = useState<ScreenSize>('desktop')
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  })

  useEffect(() => {
    const getScreenSize = (width: number): ScreenSize => {
      if (width < breakpoints.mobile) return 'mobile'
      if (width <= breakpoints.tablet) return 'tablet' // Inclut 1024px comme tablette
      return 'desktop'
    }

    const updateScreenSize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      
      setDimensions({ width, height })
      setScreenSize(getScreenSize(width))
    }

    // Set initial values
    updateScreenSize()

    // Add event listener
    window.addEventListener('resize', updateScreenSize)
    
    // Cleanup
    return () => window.removeEventListener('resize', updateScreenSize)
  }, [breakpoints])

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