/**
 * EVIDENRA Screen Recorder - Cloud Edition
 * =========================================
 * Records EVIDENRA app demo using Playwright
 */

const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

// Demo-Schritte für verschiedene App-Bereiche (VARIIERT TÄGLICH)
const DEMO_STEPS = {
  // Homepage scrollen - Features zeigen
  homepage: [
    { action: 'goto', url: 'https://evidenra.com', wait: 3000 },
    { action: 'scroll', y: 400, wait: 2000 },
    { action: 'scroll', y: 800, wait: 2000 },
    { action: 'scroll', y: 1200, wait: 2000 },
    { action: 'scroll', y: 0, wait: 1500 }
  ],
  // Features Sektion
  features: [
    { action: 'goto', url: 'https://evidenra.com/#features', wait: 2500 },
    { action: 'scroll', y: 300, wait: 2000 },
    { action: 'scroll', y: 600, wait: 2000 },
    { action: 'scroll', y: 900, wait: 2000 }
  ],
  // Pricing Seite
  pricing: [
    { action: 'goto', url: 'https://evidenra.com/pricing', wait: 2500 },
    { action: 'scroll', y: 400, wait: 2500 },
    { action: 'scroll', y: 800, wait: 2000 },
    { action: 'scroll', y: 0, wait: 1500 }
  ],
  // App Login Seite
  app_login: [
    { action: 'goto', url: 'https://app.evidenra.com', wait: 3000 },
    { action: 'scroll', y: 200, wait: 2000 },
    { action: 'scroll', y: 0, wait: 2000 }
  ],
  // How it works
  howitworks: [
    { action: 'goto', url: 'https://evidenra.com/#how-it-works', wait: 2500 },
    { action: 'scroll', y: 400, wait: 2500 },
    { action: 'scroll', y: 800, wait: 2000 }
  ],
  // Testimonials / Reviews
  reviews: [
    { action: 'goto', url: 'https://evidenra.com/#testimonials', wait: 2500 },
    { action: 'scroll', y: 300, wait: 3000 },
    { action: 'scroll', y: 600, wait: 2000 }
  ],
  // Default Demo (altes Verhalten)
  demo: [
    { action: 'goto', url: 'https://evidenra.com', wait: 2000 },
    { action: 'scroll', y: 500, wait: 2000 },
    { action: 'scroll', y: 1000, wait: 2000 },
    { action: 'scroll', y: 0, wait: 1000 }
  ]
}

// Tägliche Rotation der Demo-Typen
const DEMO_ROTATION = ['homepage', 'features', 'pricing', 'app_login', 'howitworks', 'reviews']

function getDailyDemoType() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
  return DEMO_ROTATION[dayOfYear % DEMO_ROTATION.length]
}

// Cursor-Overlay CSS (gelber Cursor)
const CURSOR_OVERLAY_CSS = `
  #genesis-cursor {
    position: fixed;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: radial-gradient(circle, #FFD700 0%, transparent 70%);
    box-shadow: 0 0 20px 10px rgba(255, 215, 0, 0.5);
    pointer-events: none;
    z-index: 999999;
    transform: translate(-50%, -50%);
    transition: all 0.15s ease-out;
  }
  #genesis-cursor.click {
    transform: translate(-50%, -50%) scale(1.5);
    background: radial-gradient(circle, #FF6B6B 0%, #FFD700 50%, transparent 70%);
  }
`

const CURSOR_OVERLAY_JS = `
  const cursor = document.createElement('div');
  cursor.id = 'genesis-cursor';
  document.body.appendChild(cursor);
  document.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });
  document.addEventListener('mousedown', () => cursor.classList.add('click'));
  document.addEventListener('mouseup', () => setTimeout(() => cursor.classList.remove('click'), 150));
`

class ScreenRecorder {
  constructor(options = {}) {
    this.outputDir = options.outputDir || '/tmp'
    this.width = options.width || 1280
    this.height = options.height || 720
    this.duration = options.duration || 30 // Sekunden
  }

  async record(demoType = 'demo') {
    const steps = DEMO_STEPS[demoType] || DEMO_STEPS.demo
    const outputPath = path.join(this.outputDir, `background-${Date.now()}.webm`)

    console.log(`[Recorder] Starting screen recording: ${demoType}`)
    console.log(`[Recorder] Output: ${outputPath}`)

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const context = await browser.newContext({
      viewport: { width: this.width, height: this.height },
      recordVideo: {
        dir: this.outputDir,
        size: { width: this.width, height: this.height }
      }
    })

    const page = await context.newPage()

    // Demo-Schritte ausführen
    let firstNavDone = false
    for (const step of steps) {
      try {
        switch (step.action) {
          case 'goto':
            console.log(`[Recorder] Navigating to: ${step.url}`)
            await page.goto(step.url, { waitUntil: 'domcontentloaded', timeout: 60000 })
            // Cursor-Overlay nach erster Navigation hinzufügen
            if (!firstNavDone) {
              await page.addStyleTag({ content: CURSOR_OVERLAY_CSS })
              await page.addScriptTag({ content: CURSOR_OVERLAY_JS })
              firstNavDone = true
            }
            break

          case 'scroll':
            console.log(`[Recorder] Scrolling to: ${step.y}`)
            await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), step.y)
            break

          case 'click':
            console.log(`[Recorder] Clicking: ${step.selector}`)
            await page.click(step.selector)
            break

          case 'hover':
            console.log(`[Recorder] Hovering: ${step.selector}`)
            await page.hover(step.selector)
            break

          case 'type':
            console.log(`[Recorder] Typing in: ${step.selector}`)
            await page.fill(step.selector, step.text)
            break
        }

        if (step.wait) {
          await page.waitForTimeout(step.wait)
        }
      } catch (err) {
        console.log(`[Recorder] Step error (continuing): ${err.message}`)
      }
    }

    // Extra Zeit am Ende
    await page.waitForTimeout(2000)

    // Recording beenden
    await page.close()
    await context.close()
    await browser.close()

    // Video-Pfad finden (Playwright speichert mit zufälligem Namen)
    const files = fs.readdirSync(this.outputDir)
    const videoFile = files.find(f => f.endsWith('.webm') && f !== path.basename(outputPath))

    if (videoFile) {
      const actualPath = path.join(this.outputDir, videoFile)
      fs.renameSync(actualPath, outputPath)
      console.log(`[Recorder] Recording saved: ${outputPath}`)
      return outputPath
    }

    throw new Error('Recording file not found')
  }
}

module.exports = ScreenRecorder
