import React, { useEffect, useRef, useState } from "react"
import * as d3 from "d3"

export default function RotatingEarth({ className = "" }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const worldDataRef = useRef({ landFeatures: null, allDots: [] })
  const rotationRef = useRef([0, 0])

  // Setup ResizeObserver for responsive canvas
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) {
        setDimensions({ width, height })
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Setup Data Loading
  useEffect(() => {
    const pointInPolygon = (point, polygon) => {
      const [x, y] = point
      let inside = false

      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i]
        const [xj, yj] = polygon[j]

        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
          inside = !inside
        }
      }

      return inside
    }

    const pointInFeature = (point, feature) => {
      const geometry = feature.geometry

      if (geometry.type === "Polygon") {
        const coordinates = geometry.coordinates
        if (!pointInPolygon(point, coordinates[0])) {
          return false
        }
        for (let i = 1; i < coordinates.length; i++) {
          if (pointInPolygon(point, coordinates[i])) {
            return false
          }
        }
        return true
      } else if (geometry.type === "MultiPolygon") {
        for (const polygon of geometry.coordinates) {
          if (pointInPolygon(point, polygon[0])) {
            let inHole = false
            for (let i = 1; i < polygon.length; i++) {
              if (pointInPolygon(point, polygon[i])) {
                inHole = true
                break
              }
            }
            if (!inHole) {
              return true
            }
          }
        }
        return false
      }

      return false
    }

    const generateDotsInPolygon = (feature, dotSpacing = 16) => {
      const dots = []
      const bounds = d3.geoBounds(feature)
      const [[minLng, minLat], [maxLng, maxLat]] = bounds

      const stepSize = dotSpacing * 0.08
      let pointsGenerated = 0

      for (let lng = minLng; lng <= maxLng; lng += stepSize) {
        for (let lat = minLat; lat <= maxLat; lat += stepSize) {
          const point = [lng, lat]
          if (pointInFeature(point, feature)) {
            dots.push(point)
            pointsGenerated++
          }
        }
      }

      return dots
    }

    const loadWorldData = async () => {
      try {
        setIsLoading(true)

        const response = await fetch(
          "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_land.json",
        )
        if (!response.ok) throw new Error("Failed to load land data")

        const landFeatures = await response.json()
        const allDots = []

        let totalDots = 0
        landFeatures.features.forEach((feature) => {
          const dots = generateDotsInPolygon(feature, 16)
          dots.forEach(([lng, lat]) => {
            allDots.push({ 
              lng, 
              lat, 
              visible: true,
              pulsePhase: Math.random() * Math.PI * 2,
              pulseSpeed: 0.0005 + Math.random() * 0.0015
            })
            totalDots++
          })
        })

        console.log(`[v0] Total dots generated: ${totalDots} across ${landFeatures.features.length} land features`)
        
        worldDataRef.current = { landFeatures, allDots }
        setIsLoading(false)
      } catch (err) {
        setError("Failed to load land map data")
        setIsLoading(false)
      }
    }

    loadWorldData()
  }, [])

  // Rendering and rotation logic
  useEffect(() => {
    if (isLoading || !canvasRef.current) return

    const canvas = canvasRef.current
    const context = canvas.getContext("2d")
    if (!context) return

    const { width: containerWidth, height: containerHeight } = dimensions
    if (containerWidth === 0 || containerHeight === 0) return

    const radius = Math.min(containerWidth, containerHeight) / 2.2
    const dpr = window.devicePixelRatio || 1
    
    canvas.width = containerWidth * dpr
    canvas.height = containerHeight * dpr
    canvas.style.width = `${containerWidth}px`
    canvas.style.height = `${containerHeight}px`
    context.scale(dpr, dpr)

    const projection = d3
      .geoOrthographic()
      .scale(radius)
      .translate([containerWidth / 2, containerHeight / 2])
      .clipAngle(90)

    const path = d3.geoPath().projection(projection).context(context)

    const { landFeatures, allDots } = worldDataRef.current

    const render = () => {
      context.clearRect(0, 0, containerWidth, containerHeight)

      const currentScale = projection.scale()
      const scaleFactor = currentScale / radius
      const time = performance.now()

      // Calculate global cycling color
      const colors = [
        { r: 56, g: 189, b: 248 }, // Cyan
        { r: 168, g: 85, b: 247 }, // Purple
        { r: 45, g: 212, b: 191 }, // Teal
        { r: 236, g: 72, b: 153 }  // Pink
      ]
      const holdTime = 4000
      const transitionTime = 2000
      const totalPhaseTime = holdTime + transitionTime
      const cycleTime = time % (colors.length * totalPhaseTime)
      const currentIndex = Math.floor(cycleTime / totalPhaseTime)
      const nextIndex = (currentIndex + 1) % colors.length
      const phaseTime = cycleTime % totalPhaseTime

      let r, g, b
      if (phaseTime < holdTime) {
         r = colors[currentIndex].r
         g = colors[currentIndex].g
         b = colors[currentIndex].b
      } else {
         const progress = (phaseTime - holdTime) / transitionTime
         const ease = progress * progress * (3 - 2 * progress) // smoothstep
         r = colors[currentIndex].r + (colors[nextIndex].r - colors[currentIndex].r) * ease
         g = colors[currentIndex].g + (colors[nextIndex].g - colors[currentIndex].g) * ease
         b = colors[currentIndex].b + (colors[nextIndex].b - colors[currentIndex].b) * ease
      }

      context.beginPath()
      context.arc(containerWidth / 2, containerHeight / 2, currentScale, 0, 2 * Math.PI)
      context.fillStyle = "rgba(0,0,0,0)"
      
      // Outer glow effect
      context.shadowColor = `rgba(${r}, ${g}, ${b}, 0.5)`
      context.shadowBlur = 25 * scaleFactor
      context.fill()
      
      context.shadowBlur = 0 // reset shadow for other elements
      context.strokeStyle = "#444444"
      context.lineWidth = 1 * scaleFactor
      context.stroke()

      if (landFeatures) {
        const graticule = d3.geoGraticule()
        context.beginPath()
        path(graticule())
        context.strokeStyle = "#444444"
        context.lineWidth = 0.5 * scaleFactor
        context.globalAlpha = 0.15
        context.stroke()
        context.globalAlpha = 1

        context.beginPath()
        landFeatures.features.forEach((feature) => {
          path(feature)
        })
        context.strokeStyle = "#333333"
        context.lineWidth = 0.5 * scaleFactor
        context.stroke()

        allDots.forEach((dot) => {
          const projected = projection([dot.lng, dot.lat])
          if (
            projected &&
            projected[0] >= 0 &&
            projected[0] <= containerWidth &&
            projected[1] >= 0 &&
            projected[1] <= containerHeight
          ) {
            context.beginPath()
            context.arc(projected[0], projected[1], 1.2 * scaleFactor, 0, 2 * Math.PI)
            
            // Apply global color with per-dot pulsing alpha
            const pulse = (Math.sin(time * dot.pulseSpeed + dot.pulsePhase) + 1) / 2
            const alpha = 0.2 + (pulse * 0.8)
            context.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`
            
            context.fill()
          }
        })
      }
    }

    let autoRotate = true
    const rotationSpeed = 0.15

    const rotate = () => {
      if (autoRotate) {
        rotationRef.current[0] += rotationSpeed
        projection.rotate(rotationRef.current)
      }
      // Always render to keep dots animating
      render()
    }

    const rotationTimer = d3.timer(rotate)

    const handleMouseDown = (event) => {
      autoRotate = false
      const startX = event.clientX
      const startY = event.clientY
      const startRotation = [...rotationRef.current]

      const handleMouseMove = (moveEvent) => {
        const sensitivity = 0.5
        const dx = moveEvent.clientX - startX
        const dy = moveEvent.clientY - startY

        rotationRef.current[0] = startRotation[0] + dx * sensitivity
        rotationRef.current[1] = startRotation[1] - dy * sensitivity
        rotationRef.current[1] = Math.max(-90, Math.min(90, rotationRef.current[1]))

        projection.rotate(rotationRef.current)
        render()
      }

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)

        setTimeout(() => {
          autoRotate = true
        }, 10)
      }

      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    const handleWheel = (event) => {
      event.preventDefault()
      const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1
      const newRadius = Math.max(radius * 0.5, Math.min(radius * 3, projection.scale() * scaleFactor))
      projection.scale(newRadius)
      render()
    }

    // Set initial rotation from ref
    projection.rotate(rotationRef.current)

    canvas.addEventListener("mousedown", handleMouseDown)
    canvas.addEventListener("wheel", handleWheel, { passive: false })

    // initial render
    render()

    return () => {
      rotationTimer.stop()
      canvas.removeEventListener("mousedown", handleMouseDown)
      canvas.removeEventListener("wheel", handleWheel)
    }
  }, [dimensions, isLoading])

  if (error) {
    return (
      <div className={`dark flex items-center justify-center bg-card rounded-2xl p-8 ${className}`}>
        <div className="text-center">
          <p className="dark text-destructive font-semibold mb-2">Error loading Earth visualization</p>
          <p className="dark text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover dark"
      />
    </div>
  )
}
