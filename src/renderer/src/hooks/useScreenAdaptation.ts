import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'

const BASE_WIDTH = 1920

export function useScreenAdaptation(): void {
  const { uiScale } = useAppStore()

  useEffect(() => {
    function updateZoom(): void {
      if (!window.webFrame) {
        console.warn('webFrame API is not available')
        return
      }

      let zoomFactor = 1.0

      if (uiScale === 'auto') {
        const screenWidth = window.screen.width

        // 自动计算逻辑：以 1920 为基准。如果屏幕小于 1920（比如 1440 或 1536 的笔记本），
        // 最小保持 1.0（即 100%）不缩小，因为 100% 在笔记本上已经是最佳显示效果。
        // 只有当屏幕分辨率大于 1920 时（比如 2K 的 2560，或者 4K 的 3840），才按比例放大。
        let calculatedScale = screenWidth / BASE_WIDTH

        // 限制自动缩放区间：最小 1.0（不缩小），最大 2.5（防止过大）
        calculatedScale = Math.max(1.0, Math.min(calculatedScale, 2.5))
        zoomFactor = calculatedScale
      } else {
        zoomFactor = parseFloat(uiScale)
      }

      window.webFrame.setZoomFactor(zoomFactor)
    }

    updateZoom()

    // Listening to resize to catch monitor changes (when moving window across screens)
    window.addEventListener('resize', updateZoom)

    // Also listen to system zoom/display changes if possible
    window.matchMedia('(resolution: 1dppx)').addEventListener('change', updateZoom)

    return () => {
      window.removeEventListener('resize', updateZoom)
      window.matchMedia('(resolution: 1dppx)').removeEventListener('change', updateZoom)
    }
  }, [uiScale])
}
