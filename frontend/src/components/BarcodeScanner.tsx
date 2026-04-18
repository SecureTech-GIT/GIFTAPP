import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode, Html5QrcodeResult } from 'html5-qrcode'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X, Camera, SwitchCamera } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface BarcodeScannerProps {
  onScan: (decodedText: string, result: Html5QrcodeResult) => void
  onClose: () => void
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isClosingRef = useRef(false)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([])
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0)
  const hasNavigated = useRef(false)

  const stopAllVideoTracks = () => {
    try {
      const videos = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[]
      videos.forEach((video) => {
        const stream = (video as any)?.srcObject as MediaStream | null
        if (!stream) return
        try {
          stream.getTracks().forEach((t) => {
            try {
              t.stop()
            } catch {
              // ignore
            }
          })
        } catch {
          // ignore
        }
        try {
          ;(video as any).srcObject = null
        } catch {
          // ignore
        }
      })
    } catch {
      // ignore
    }
  }

  // Helper to fully stop and release camera
  const stopScanner = async () => {
    isClosingRef.current = true
    if (scannerRef.current) {
      try {
        // Some browsers report incorrect state; attempt stop regardless.
        try {
          await scannerRef.current.stop()
        } catch {
          // ignore
        }
        try {
          await scannerRef.current.clear() // release camera
        } catch {
          // ignore
        }
        scannerRef.current = null
        setIsScanning(false)
      } catch (err) {
        console.error('Scanner stop/clear error:', err)
      }
    }

	// Extra safety: stop any active MediaStream tracks attached to the video element.
	try {
		const container = document.getElementById('scanner-container')
		const video = container?.querySelector('video') as HTMLVideoElement | null
		const stream = (video as any)?.srcObject as MediaStream | null
		if (stream) {
			stream.getTracks().forEach((t) => {
				try {
					t.stop()
				} catch {
					// ignore
				}
			})
			;(video as any).srcObject = null
		}
		// Remove scanner DOM to ensure browser releases camera indicator in all cases
		if (container) {
			container.innerHTML = ''
		}
	} catch (err) {
		console.error('Failed to stop media tracks:', err)
	}

	// Final fallback: stop any video track in the document.
	stopAllVideoTracks()

	isClosingRef.current = false
  }

  useEffect(() => {
    hasNavigated.current = false
    let cancelled = false
    const initScanner = async () => {
      try {
        // Ensure previous streams are not lingering before we open camera again.
        stopAllVideoTracks()
        const devices = await Html5Qrcode.getCameras()
        if (cancelled) return
        if (devices && devices.length > 0) {
          setCameras(devices)
          await startScanning(devices[0].id)
        } else {
          setError(t('barcodeScanner.errors.noCamera'))
        }
      } catch (err) {
        setError(t('barcodeScanner.errors.cameraAccessDenied'))
        console.error('Camera error:', err)
      }
    }

    initScanner()

    return () => {
      cancelled = true
      stopScanner()
    }
  }, [t])

  const handleScanSuccess = async (decodedText: string, result: Html5QrcodeResult) => {
    if (hasNavigated.current) return
    hasNavigated.current = true

    await stopScanner() // fully stop camera

    try {
      // URL handling
      if (decodedText.startsWith('http://') || decodedText.startsWith('https://')) {
        try {
          const url = new URL(decodedText)
          if (url.origin === window.location.origin || url.host.includes('localhost') || url.host.includes('127.0.0.1')) {
            const path = url.pathname + url.search + url.hash
            onClose()
            setTimeout(() => navigate(path, { replace: false }), 50)
            return
          } else {
            window.open(decodedText, '_blank')
            onClose()
            return
          }
        } catch (urlError) {
          console.error('URL parsing error:', urlError)
        }
      }

      // Gift ID handling
      if (decodedText.match(/^GIFT-\d+$/i)) {
        onClose()
        setTimeout(() => navigate(`/gifts/${decodedText}`, { replace: false }), 50)
        return
      }

      // Other barcodes
      onScan(decodedText, result)
      onClose()
    } catch (err) {
      console.error('Scan handling error:', err)
      onScan(decodedText, result)
      onClose()
    }
  }

  const startScanning = async (cameraId: string) => {
    try {
      await stopScanner() // stop any previous scanner

      scannerRef.current = new Html5Qrcode('scanner-container')

      await scannerRef.current.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        handleScanSuccess,
        () => {} // ignore scanning errors
      )

      setIsScanning(true)
      setError(null)
    } catch (err) {
      setError(t('barcodeScanner.errors.failedToStart'))
      console.error('Scanner start error:', err)
    }
  }

  const switchCamera = async () => {
    if (cameras.length <= 1) return
    const nextIndex = (currentCameraIndex + 1) % cameras.length
    setCurrentCameraIndex(nextIndex)
    await startScanning(cameras[nextIndex].id)
  }

  const handleClose = async () => {
    await stopScanner() // fully stop camera
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            {t('barcodeScanner.title')}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            id="scanner-container"
            className="w-full aspect-square bg-muted rounded-lg overflow-hidden relative"
          />

          {error && (
            <div className="text-center text-destructive text-sm p-4 bg-destructive/10 rounded-lg">
              {error}
            </div>
          )}

          {!isScanning && !error && (
            <div className="text-center text-muted-foreground text-sm p-4">
              {t('barcodeScanner.initializing')}
            </div>
          )}

          {isScanning && (
            <p className="text-center text-muted-foreground text-sm">
              {t('barcodeScanner.instructions')}
            </p>
          )}

          <div className="flex gap-2">
            {cameras.length > 1 && (
              <Button variant="outline" onClick={switchCamera} className="flex-1">
                <SwitchCamera className="h-4 w-4 mr-2" />
                {t('barcodeScanner.switchCamera')}
              </Button>
            )}
            <Button variant="destructive" onClick={handleClose} className="flex-1">
              {t('common.cancel')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}