/**
 * EVIDENRA Genesis Cloud - Video Generation Engine v3.0
 * ======================================================
 * Railway-deployed video creation service
 *
 * NEU in v3.0: HeyGen Video-Background Integration
 * - Playwright nimmt Website auf
 * - Video wird zu HeyGen hochgeladen als Background
 * - HeyGen rendert Avatar ÜBER dem Video (kein Chromakey nötig!)
 * - Perfekte Freistellung durch HeyGen selbst
 *
 * - 21 verschiedene Scripts (14 EN + 7 DE, täglich rotierend)
 * - Automatisches Aufräumen alter Videos
 */

require('dotenv').config()
const express = require('express')
const https = require('https')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { createClient } = require('@supabase/supabase-js')
const FormData = require('form-data')
const ScreenRecorder = require('./recorder')

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3000
const TEMP_DIR = '/tmp/genesis'

// API Key for autopilot authentication (with fallback)
// Accept both old and new key formats for compatibility
const GENESIS_KEY = (process.env.GENESIS_API_KEY || 'evidenra-genesis-2024').replace(/\\n/g, '').trim()
const VALID_KEYS = [GENESIS_KEY, 'evidenra-genesis-2024', 'genesis-evidenra-2024-secret']
const isValidKey = (key) => VALID_KEYS.some(k => key === `Bearer ${k}`)

// Temp-Ordner erstellen
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true })
}

// Supabase Client - trim API keys to remove any whitespace/newlines
const supabase = createClient(
  (process.env.SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_KEY || '').trim()
)

// ============================================
// AVATARE MIT PASSENDEN STIMMEN
// ============================================
// EIGENER AVATAR - "Team" (dein Custom Avatar auf HeyGen)
const CUSTOM_AVATAR = {
  id: 'd90309df9f80462ba214a43ca9f9398f',
  name: 'Team (Custom)',
  gender: 'male'  // Für Stimme - anpassen falls weiblich
}

// Fallback Avatare (falls Custom nicht verfügbar)
const AVATARS_FEMALE = [
  { id: 'Annie_expressive_public', name: 'Annie', gender: 'female' },
  { id: 'Aubrey_expressive_2024112701', name: 'Aubrey', gender: 'female' }
]

const AVATARS_MALE = [
  { id: 'Albert_public_1', name: 'Albert', gender: 'male' },
  { id: 'Adrian_public_20240312', name: 'Adrian', gender: 'male' }
]

// Alle Avatare - NUR Stock Avatare, kein persönlicher Custom Avatar
const AVATARS = [...AVATARS_FEMALE, ...AVATARS_MALE]

// Avatar-Konfiguration pro Format
const AVATAR_CONFIG = {
  'youtube': {
    scale: 0.85,
    offset: { x: 0, y: 0 },
    position: 'center'  // Mittig
  },
  'tiktok': {
    scale: 0.6,  // Kleiner für Portrait
    offset: { x: 0, y: 0.2 },  // Leicht nach unten
    position: 'bottom-center'
  },
  'instagram': {
    scale: 0.7,  // Mittel für Quadrat
    offset: { x: 0, y: 0.15 },  // Leicht nach unten
    position: 'bottom-center'
  },
  'twitter': {
    scale: 0.85,
    offset: { x: 0, y: 0 },
    position: 'center'
  }
}

// Stimmen passend zum Geschlecht (verified from HeyGen API)
const VOICES = {
  female: 'fb8c5c3f02854c57a4da182d4ed59467', // Ivy (female English)
  male: 'fba616e37c3f4363844cc0be0721ddbd'    // Mark (male English)
}

// ============================================
// HINTERGRUND FÜR AVATAR (Greenscreen für Compositing)
// ============================================
// Grüner Hintergrund für Chroma-Key
const GREENSCREEN_BACKGROUND = { type: 'color', value: '#00FF00' }

// Fallback-Hintergrundfarben (wenn kein Compositing)
const BACKGROUNDS = [
  { type: 'color', value: '#1a1a2e' },  // Dunkelblau
  { type: 'color', value: '#0f0f23' },  // Fast Schwarz
  { type: 'color', value: '#1e3a5f' },  // Navy
  { type: 'color', value: '#2d1b4e' },  // Lila Dunkel
  { type: 'color', value: '#0a2540' },  // Mitternachtsblau
]

// ============================================
// 14 VERSCHIEDENE SCRIPTS (TikTok-Style)
// ============================================
const SCRIPTS = {
  // Tag 1: Thesis Struggle
  thesis_struggle: `POV: You're drowning in interview transcripts at 2 AM...

We've all been there. Hours of recordings, mountains of data, and no idea where to start.

But what if AI could analyze your interviews in minutes? EVIDENRA does exactly that. Upload your data, and watch themes emerge automatically.

Founding members save 60%. Link in bio!`,

  // Tag 2: Before/After
  before_after: `Qualitative analysis: Expectation vs Reality.

Before EVIDENRA: Weeks of manual coding, sticky notes everywhere, impostor syndrome at its peak.

After EVIDENRA: AI identifies themes in minutes. You focus on insights, not mechanics.

This is what they don't teach you in methods class. 60% off for founding members!`,

  // Tag 3: Speed Run
  speed_run: `Speed running my thesis data analysis...

Step 1: Upload 20 interview transcripts. Step 2: Watch EVIDENRA's AI work its magic. Step 3: Export a complete thematic analysis.

Total time: 15 minutes instead of 15 days.

Your advisor will think you're a genius. 60% founding member discount at evidenra.com!`,

  // Tag 4: That Moment
  that_moment: `That moment when your supervisor asks for your analysis progress...

And you can actually show them a complete thematic map with evidence-based coding.

EVIDENRA turned my research chaos into organized insights. Game changer for qualitative researchers.

Join as a founding member and save 60%!`,

  // Tag 5: Glow Up
  glow_up: `My research glow-up was switching to EVIDENRA.

Before: Manual coding, existential dread, questioning my life choices.

After: AI-powered analysis, clear themes, confidence in my findings.

If you're struggling with qualitative data, this is your sign. 60% off for founding members!`,

  // Tag 6: Storytime
  storytime: `Storytime: How I analyzed 50 interviews in one weekend.

Plot twist: I didn't pull an all-nighter. I used EVIDENRA.

The AI identified themes I would have missed. It coded everything systematically. And I still had time for self-care.

This tool is breaking the "suffering researcher" stereotype. 60% off now!`,

  // Tag 7: Unpopular Opinion
  unpopular_opinion: `Unpopular opinion: Manual qualitative coding is outdated.

There, I said it. We have AI that can help us analyze data rigorously and efficiently.

EVIDENRA doesn't replace your expertise - it amplifies it. You still interpret, you still think critically. But faster.

Founding members save 60%. Future you will thank you!`,

  // Tag 8: Day in Life
  day_in_life: `A day in my life as a PhD student using EVIDENRA...

Morning: Upload interview batch. Grab coffee.

Afternoon: Review AI-generated themes. Refine codes.

Evening: Export analysis, send to supervisor, actually have a life.

This is research in 2024. Join 60% off!`,

  // Tag 9: Rating
  rating: `Rating qualitative analysis tools as a researcher...

NVivo: Powerful but expensive. Learning curve? Steep.
Atlas.ti: Good, but dated interface.
Excel: Please no.
EVIDENRA: AI-powered, intuitive, actually enjoyable.

The winner is clear. 60% founding member discount!`,

  // Tag 10: POV Advisor
  pov_advisor: `POV: Your advisor reviewing your EVIDENRA analysis...

"This thematic map is remarkably comprehensive."
"Your coding is systematic and well-documented."
"How did you finish so quickly?"

The secret? AI-assisted analysis. Don't tell them. Just enjoy the praise. 60% off!`,

  // Tag 11: Expectation Reality
  expectation_reality: `Qualitative research: What I expected vs What I got.

Expected: Meaningful insights, academic fulfillment.
Got: Drowning in transcripts, crying over codes.

Then I found EVIDENRA. Now I actually enjoy my research again.

Save 60% as a founding member!`,

  // Tag 12: Me vs The Person
  me_vs_person: `Me vs The person who told me to "just use Excel" for qualitative analysis.

Me: Using AI-powered EVIDENRA to identify themes automatically.
Them: Still color-coding cells manually after 3 weeks.

Work smarter, not harder. 60% off for founding members!`,

  // Tag 13: Academic Community
  academic_community: `To my fellow qualitative researchers struggling right now...

You're not alone. Analysis is hard. Imposter syndrome is real.

But tools like EVIDENRA exist to help, not replace you. Let AI handle the tedious parts while you focus on interpretation.

Join our founding member community. 60% off!`,

  // Tag 14: Founding Special
  founding_special: `HUGE announcement for qualitative researchers!

EVIDENRA is launching, and founding members get 60% OFF forever.

This AI tool analyzes interviews, focus groups, and documents. It identifies themes, codes your data, and exports publication-ready results.

Limited spots available. Visit evidenra.com now!`
}

// DEUTSCHE SCRIPTS
const SCRIPTS_DE = {
  thesis_kampf: `POV: Du ertrinkst um 2 Uhr nachts in Interview-Transkripten...

Kennen wir alle. Stundenlange Aufnahmen, Berge von Daten, und keine Ahnung wo anfangen.

Aber was, wenn KI deine Interviews in Minuten analysieren könnte? EVIDENRA macht genau das. Lade deine Daten hoch und sieh zu, wie Themen automatisch entstehen.

Gründungsmitglieder sparen 60%. Link in Bio!`,

  vorher_nachher: `Qualitative Analyse: Erwartung vs Realität.

Vor EVIDENRA: Wochen manuelles Kodieren, überall Post-its, Impostor-Syndrom auf Maximum.

Nach EVIDENRA: KI identifiziert Themen in Minuten. Du konzentrierst dich auf Erkenntnisse, nicht Mechanik.

Das lehrt man dir nicht im Methodenkurs. 60% für Gründungsmitglieder!`,

  schnelldurchlauf: `Speedrun meiner Thesis-Datenanalyse...

Schritt 1: 20 Interview-Transkripte hochladen. Schritt 2: EVIDENRAs KI bei der Arbeit zusehen. Schritt 3: Komplette thematische Analyse exportieren.

Gesamtzeit: 15 Minuten statt 15 Tage.

Dein Betreuer wird denken, du bist ein Genie. 60% Gründer-Rabatt auf evidenra.com!`,

  dieser_moment: `Dieser Moment, wenn dein Betreuer nach dem Analysefortschritt fragt...

Und du ihnen tatsächlich eine komplette thematische Karte mit evidenzbasierter Kodierung zeigen kannst.

EVIDENRA hat mein Forschungschaos in organisierte Erkenntnisse verwandelt. Game Changer für qualitative Forscher.

Werde Gründungsmitglied und spare 60%!`,

  forschungs_glow_up: `Mein Forschungs-Glow-Up war der Wechsel zu EVIDENRA.

Vorher: Manuelles Kodieren, existenzielle Verzweiflung, Lebensentscheidungen hinterfragen.

Nachher: KI-gestützte Analyse, klare Themen, Vertrauen in meine Ergebnisse.

Wenn du mit qualitativen Daten kämpfst, ist das dein Zeichen. 60% für Gründungsmitglieder!`,

  werkzeug_bewertung: `Bewertung qualitativer Analyse-Tools als Forscher...

NVivo: Mächtig aber teuer. Lernkurve? Steil.
Atlas.ti: Gut, aber veraltete Oberfläche.
Excel: Bitte nicht.
EVIDENRA: KI-gestützt, intuitiv, macht tatsächlich Spaß.

Der Gewinner ist klar. 60% Gründer-Rabatt!`,

  akademische_gemeinschaft: `An alle qualitativen Forscher, die gerade kämpfen...

Ihr seid nicht allein. Analyse ist schwer. Impostor-Syndrom ist real.

Aber Tools wie EVIDENRA existieren, um zu helfen, nicht zu ersetzen. Lass KI die mühsamen Teile erledigen, während du dich auf Interpretation konzentrierst.

Tritt unserer Gründer-Community bei. 60% Rabatt!`
}

// Script-Namen für tägliche Rotation (EN und DE gemischt)
const ALL_SCRIPTS = { ...SCRIPTS, ...SCRIPTS_DE }
const SCRIPT_KEYS = Object.keys(ALL_SCRIPTS)

// Demo-Typen für tägliche Rotation
// Website-Demos werden live aufgenommen, App-Demos nutzen pre-recorded Videos
const DEMO_ROTATION = [
  'homepage',      // Tag 1: Website Homepage (live)
  'app_basic',     // Tag 2: BASIC App (pre-recorded)
  'features',      // Tag 3: Website Features (live)
  'app_pro',       // Tag 4: PRO App (pre-recorded)
  'pricing',       // Tag 5: Website Pricing (live)
  'app_ultimate',  // Tag 6: ULTIMATE App (pre-recorded)
  'howitworks',    // Tag 7: Website How It Works (live)
  'reviews'        // Tag 8: Website Reviews (live)
]

// Pre-recorded App Demo Videos auf Supabase
const APP_DEMO_VIDEOS = {
  'app_basic': 'https://qkcukdgrqncahpvrrxtm.supabase.co/storage/v1/object/public/videos/app-demo-basic.mp4',
  'app_pro': 'https://qkcukdgrqncahpvrrxtm.supabase.co/storage/v1/object/public/videos/app-demo-pro.mp4',
  'app_ultimate': 'https://qkcukdgrqncahpvrrxtm.supabase.co/storage/v1/object/public/videos/app-demo-ultimate.mp4',
  'app_basic_tour': 'https://qkcukdgrqncahpvrrxtm.supabase.co/storage/v1/object/public/videos/app-demo-basic.mp4',
  'app_basic_features': 'https://qkcukdgrqncahpvrrxtm.supabase.co/storage/v1/object/public/videos/app-demo-basic.mp4'
}

// Tägliches Script basierend auf Datum
function getDailyScript() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
  const index = dayOfYear % SCRIPT_KEYS.length
  const key = SCRIPT_KEYS[index]
  const isGerman = SCRIPTS_DE[key] !== undefined
  return { key, lang: isGerman ? 'de' : 'en', script: ALL_SCRIPTS[key] }
}

// Täglicher Demo-Typ für Website-Aufnahme
function getDailyDemoType() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
  return DEMO_ROTATION[dayOfYear % DEMO_ROTATION.length]
}

// Zufälliger Hintergrund
function getRandomBackground() {
  return BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)]
}

// ============================================
// HEYGEN API
// ============================================

// WebM Video mit transparentem Hintergrund erstellen (für Compositing!)
async function createHeyGenWebM(topic = 'auto') {
  const apiKey = (process.env.HEYGEN_API_KEY || '').trim()
  if (!apiKey) {
    return { success: false, error: 'HEYGEN_API_KEY not configured' }
  }

  // Script auswählen
  let scriptKey, script, lang
  if (topic === 'auto') {
    const daily = getDailyScript()
    scriptKey = daily.key
    script = daily.script
    lang = daily.lang
  } else if (SCRIPTS[topic]) {
    scriptKey = topic
    script = SCRIPTS[topic]
    lang = 'en'
  } else if (SCRIPTS_DE[topic]) {
    scriptKey = topic
    script = SCRIPTS_DE[topic]
    lang = 'de'
  } else {
    const daily = getDailyScript()
    scriptKey = daily.key
    script = daily.script
    lang = daily.lang
  }

  const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)]
  const voice = VOICES[avatar.gender] || VOICES.female

  console.log(`[Genesis] Creating TRANSPARENT WebM video:`)
  console.log(`  - Script: ${scriptKey} (${lang.toUpperCase()})`)
  console.log(`  - Avatar: ${avatar.name} (${avatar.gender})`)
  console.log(`  - Format: WebM with Alpha Channel (transparent background)`)

  // v1/video.webm API für transparenten Hintergrund
  const payload = JSON.stringify({
    avatar_id: avatar.id,
    input_text: script,
    voice_id: voice,
    avatar_style: 'normal',
    width: 720,   // WebM unterstützt kleinere Größen
    height: 720
  })

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.heygen.com',
      path: '/v1/video.webm',
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          console.log(`[Genesis] WebM API Response:`, JSON.stringify(result).substring(0, 200))
          if (result.data?.video_id) {
            resolve({
              success: true,
              videoId: result.data.video_id,
              avatar: avatar.name,
              script: scriptKey,
              format: 'webm'
            })
          } else if (result.error) {
            // Fallback auf normales Video mit Green Screen
            console.log(`[Genesis] WebM failed, falling back to green screen: ${result.error.message || result.error}`)
            resolve({ success: false, error: result.error.message || result.error, fallback: true })
          } else {
            resolve({ success: false, error: 'Unknown WebM API error' })
          }
        } catch (e) {
          resolve({ success: false, error: e.message })
        }
      })
    })
    req.on('error', (e) => resolve({ success: false, error: e.message }))
    req.write(payload)
    req.end()
  })
}

// Video Format Configurations
const VIDEO_FORMATS = {
  'youtube': { width: 1920, height: 1080, aspect: '16:9', name: 'YouTube/LinkedIn' },
  'tiktok': { width: 1080, height: 1920, aspect: '9:16', name: 'TikTok/Reels' },
  'instagram': { width: 1080, height: 1080, aspect: '1:1', name: 'Instagram Feed' },
  'twitter': { width: 1280, height: 720, aspect: '16:9', name: 'Twitter' }
}

async function createHeyGenVideo(topic = 'auto', useGreenscreen = false, format = 'youtube') {
  const apiKey = (process.env.HEYGEN_API_KEY || '').trim()
  if (!apiKey) {
    return { success: false, error: 'HEYGEN_API_KEY not configured' }
  }

  // Get format configuration
  const formatConfig = VIDEO_FORMATS[format] || VIDEO_FORMATS.youtube

  // Wenn 'auto', nutze tägliches Script (mit Sprachwechsel DE/EN)
  let scriptKey, script, lang
  if (topic === 'auto') {
    const daily = getDailyScript()
    scriptKey = daily.key
    script = daily.script
    lang = daily.lang
  } else if (SCRIPTS[topic]) {
    scriptKey = topic
    script = SCRIPTS[topic]
    lang = 'en'
  } else if (SCRIPTS_DE[topic]) {
    scriptKey = topic
    script = SCRIPTS_DE[topic]
    lang = 'de'
  } else {
    const daily = getDailyScript()
    scriptKey = daily.key
    script = daily.script
    lang = daily.lang
  }

  // Standard HeyGen Avatare verwenden (rotiert)
  const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)]

  // Greenscreen für Compositing, sonst normale Hintergrundfarbe
  const background = useGreenscreen ? GREENSCREEN_BACKGROUND : getRandomBackground()

  // WICHTIG: Stimme passend zum Avatar-Geschlecht UND Sprache!
  const voice = VOICES[avatar.gender] || VOICES.male

  // Format-spezifische Avatar-Konfiguration
  const avatarCfg = AVATAR_CONFIG[format] || AVATAR_CONFIG.youtube

  console.log(`[Genesis] Creating video:`)
  console.log(`  - Script: ${scriptKey} (${lang.toUpperCase()})`)
  console.log(`  - Avatar: ${avatar.name} (${avatar.gender})`)
  console.log(`  - Voice: ${avatar.gender}`)
  console.log(`  - Format: ${formatConfig.name} (${formatConfig.aspect})`)
  console.log(`  - Avatar Scale: ${avatarCfg.scale}, Offset: x=${avatarCfg.offset.x}, y=${avatarCfg.offset.y}`)
  console.log(`  - Background: ${useGreenscreen ? 'GREENSCREEN' : background.value}`)

  const payload = JSON.stringify({
    video_inputs: [{
      character: {
        type: 'avatar',
        avatar_id: avatar.id,
        avatar_style: 'normal',
        scale: avatarCfg.scale,
        offset: avatarCfg.offset
      },
      voice: {
        type: 'text',
        input_text: script,
        voice_id: voice,
        speed: 1.0
      },
      background: background
    }],
    dimension: { width: formatConfig.width, height: formatConfig.height },
    aspect_ratio: formatConfig.aspect
  })

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.heygen.com',
      path: '/v2/video/generate',
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (result.data?.video_id) {
            resolve({
              success: true,
              videoId: result.data.video_id,
              avatar: avatar.name,
              script: scriptKey
            })
          } else {
            const errDetail = result.error?.message || result.message || JSON.stringify(result.error || result) || 'HeyGen error'
            resolve({ success: false, error: errDetail })
          }
        } catch (e) {
          resolve({ success: false, error: e?.message || JSON.stringify(e) || 'Parse error' })
        }
      })
    })
    req.on('error', (e) => resolve({ success: false, error: e?.message || JSON.stringify(e) || 'Request error' }))
    req.write(payload)
    req.end()
  })
}

async function checkHeyGenStatus(videoId) {
  const apiKey = (process.env.HEYGEN_API_KEY || '').trim()

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.heygen.com',
      path: `/v1/video_status.get?video_id=${videoId}`,
      method: 'GET',
      headers: { 'X-Api-Key': apiKey }
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          const errData = result.data?.error
          const errStr = typeof errData === 'string' ? errData : (errData ? JSON.stringify(errData) : undefined)
          resolve({
            status: result.data?.status || 'unknown',
            videoUrl: result.data?.video_url,
            error: errStr
          })
        } catch (e) {
          resolve({ status: 'error', error: e?.message || JSON.stringify(e) || 'Parse error' })
        }
      })
    })
    req.on('error', (e) => resolve({ status: 'error', error: e?.message || JSON.stringify(e) || 'Request error' }))
    req.end()
  })
}

async function waitForVideo(videoId, maxWaitMs = 600000) {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    const status = await checkHeyGenStatus(videoId)
    console.log(`[Genesis] Video ${videoId} status: ${status.status}`)

    if (status.status === 'completed' && status.videoUrl) {
      return status.videoUrl
    }

    if (status.status === 'failed') {
      const errStatus = typeof status.error === 'string' ? status.error : JSON.stringify(status.error)
      throw new Error(errStatus || 'Video generation failed')
    }

    await new Promise(r => setTimeout(r, 15000))
  }

  throw new Error('Video generation timeout')
}

// ============================================
// HEYGEN ASSET UPLOAD (für Video-Backgrounds)
// ============================================
async function uploadVideoToHeyGen(videoPath) {
  const apiKey = (process.env.HEYGEN_API_KEY || '').trim()
  if (!apiKey) {
    throw new Error('HEYGEN_API_KEY not configured')
  }

  console.log(`[Genesis] Uploading video to HeyGen: ${videoPath}`)

  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', fs.createReadStream(videoPath))

    const req = https.request({
      hostname: 'upload.heygen.com',
      path: '/v1/asset',
      method: 'POST',
      headers: {
        ...form.getHeaders(),
        'X-Api-Key': apiKey
      }
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          console.log(`[Genesis] HeyGen Upload Response:`, JSON.stringify(result).substring(0, 300))

          if (result.data?.id || result.data?.asset_id) {
            const assetId = result.data.id || result.data.asset_id
            console.log(`[Genesis] Video uploaded successfully! Asset ID: ${assetId}`)
            resolve(assetId)
          } else {
            console.error(`[Genesis] Upload failed:`, result)
            reject(new Error(result.error?.message || 'Upload failed'))
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}, data: ${data.substring(0, 200)}`))
        }
      })
    })

    req.on('error', reject)
    form.pipe(req)
  })
}

// Avatar Video MIT Video-URL als Background erstellen (kein Chromakey nötig!)
// format: 'youtube', 'tiktok', 'instagram', 'twitter'
async function createHeyGenVideoWithBackground(topic = 'auto', videoUrl, format = 'youtube') {
  const apiKey = (process.env.HEYGEN_API_KEY || '').trim()
  if (!apiKey) {
    return { success: false, error: 'HEYGEN_API_KEY not configured' }
  }

  // Get format configuration
  const formatConfig = VIDEO_FORMATS[format] || VIDEO_FORMATS.youtube

  // Script auswählen
  let scriptKey, script, lang
  if (topic === 'auto') {
    const daily = getDailyScript()
    scriptKey = daily.key
    script = daily.script
    lang = daily.lang
  } else if (SCRIPTS[topic]) {
    scriptKey = topic
    script = SCRIPTS[topic]
    lang = 'en'
  } else if (SCRIPTS_DE[topic]) {
    scriptKey = topic
    script = SCRIPTS_DE[topic]
    lang = 'de'
  } else {
    const daily = getDailyScript()
    scriptKey = daily.key
    script = daily.script
    lang = daily.lang
  }

  // Standard HeyGen Avatare verwenden (NICHT den persönlichen Custom Avatar)
  // Rotiert durch die verfügbaren Stock-Avatare
  const allStockAvatars = [...AVATARS_FEMALE, ...AVATARS_MALE]
  const avatar = allStockAvatars[Math.floor(Math.random() * allStockAvatars.length)]
  const voice = VOICES[avatar.gender] || VOICES.female

  // Format-spezifische Avatar-Konfiguration für Video-Background
  // Rechts unten positioniert, damit Website sichtbar bleibt
  const avatarCfg = {
    'youtube': { scale: 0.45, offset: { x: 0.35, y: 0.35 } },
    'tiktok': { scale: 0.35, offset: { x: 0, y: 0.3 } },  // Mittig unten
    'instagram': { scale: 0.4, offset: { x: 0.25, y: 0.25 } },
    'twitter': { scale: 0.45, offset: { x: 0.35, y: 0.35 } }
  }[format] || { scale: 0.45, offset: { x: 0.35, y: 0.35 } }

  console.log(`[Genesis] Creating video WITH VIDEO URL BACKGROUND:`)
  console.log(`  - Script: ${scriptKey} (${lang.toUpperCase()})`)
  console.log(`  - Avatar: ${avatar.name} (${avatar.gender})`)
  console.log(`  - Format: ${formatConfig.name} (${formatConfig.aspect})`)
  console.log(`  - Avatar: scale=${avatarCfg.scale}, offset=(${avatarCfg.offset.x}, ${avatarCfg.offset.y})`)
  console.log(`  - Background: ${videoUrl}`)

  const payload = JSON.stringify({
    video_inputs: [{
      character: {
        type: 'avatar',
        avatar_id: avatar.id,
        avatar_style: 'normal',
        scale: avatarCfg.scale,
        offset: avatarCfg.offset
      },
      voice: {
        type: 'text',
        input_text: script,
        voice_id: voice,
        speed: 1.0
      },
      background: {
        type: 'video',
        url: videoUrl,
        play_style: 'loop'
      }
    }],
    dimension: { width: formatConfig.width, height: formatConfig.height },
    aspect_ratio: formatConfig.aspect
  })

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.heygen.com',
      path: '/v2/video/generate',
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          console.log(`[Genesis] HeyGen Video Response:`, JSON.stringify(result).substring(0, 300))

          if (result.data?.video_id) {
            resolve({
              success: true,
              videoId: result.data.video_id,
              avatar: avatar.name,
              script: scriptKey
            })
          } else {
            const errDetail = result.error?.message || result.message || JSON.stringify(result.error || result) || 'HeyGen video-bg error'
            resolve({ success: false, error: errDetail })
          }
        } catch (e) {
          resolve({ success: false, error: e?.message || JSON.stringify(e) || 'Parse error' })
        }
      })
    })
    req.on('error', (e) => resolve({ success: false, error: e?.message || JSON.stringify(e) || 'Request error' }))
    req.write(payload)
    req.end()
  })
}

// ============================================
// WEBSITE VIDEO MIT TTS (KEIN AVATAR!)
// Erstellt Video nur mit Website-Recording + Voiceover
// ============================================
async function createWebsiteVideoWithTTS(topic = 'auto', format = 'youtube') {
  const formatConfig = VIDEO_FORMATS[format] || VIDEO_FORMATS.youtube

  // Script auswählen
  let scriptKey, script, lang
  if (topic === 'auto') {
    const daily = getDailyScript()
    scriptKey = daily.key
    script = daily.script
    lang = daily.lang
  } else if (SCRIPTS[topic]) {
    scriptKey = topic
    script = SCRIPTS[topic]
    lang = 'en'
  } else if (SCRIPTS_DE[topic]) {
    scriptKey = topic
    script = SCRIPTS_DE[topic]
    lang = 'de'
  } else {
    const daily = getDailyScript()
    scriptKey = daily.key
    script = daily.script
    lang = daily.lang
  }

  console.log(`[Genesis] Creating WEBSITE-ONLY video (NO AVATAR):`)
  console.log(`  - Script: ${scriptKey} (${lang.toUpperCase()})`)
  console.log(`  - Format: ${formatConfig.name} (${formatConfig.aspect})`)
  console.log(`  - Mode: Website Recording + TTS Voiceover`)

  try {
    // Schritt 1: Website aufnehmen
    console.log(`[Genesis] Step 1: Recording website...`)
    const recorder = new ScreenRecorder({ outputDir: TEMP_DIR })
    const demoType = getRandomDemoType()
    const recordingResult = await recorder.record(demoType, format)

    if (!recordingResult.success) {
      return { success: false, error: `Recording failed: ${recordingResult.error}` }
    }

    const webmPath = recordingResult.path

    // Schritt 2: WebM zu MP4 konvertieren
    console.log(`[Genesis] Step 2: Converting to MP4...`)
    const mp4Path = webmPath.replace('.webm', '.mp4')
    execSync(`ffmpeg -y -i "${webmPath}" -c:v libx264 -preset fast -crf 23 -an "${mp4Path}"`, { stdio: 'inherit' })

    // Schritt 3: TTS Audio generieren
    console.log(`[Genesis] Step 3: Generating TTS audio...`)
    const audioPath = path.join(TEMP_DIR, `tts_${Date.now()}.mp3`)
    const ttsResult = await generateTTSAudio(script, lang, audioPath)

    if (!ttsResult.success) {
      // Fallback: Video ohne Audio
      console.log(`[Genesis] TTS failed, uploading video without audio`)
      const finalPath = mp4Path
      const filename = `no-avatar-${format}-${Date.now()}.mp4`
      const buffer = fs.readFileSync(finalPath)

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filename, buffer, { contentType: 'video/mp4', upsert: true })

      if (uploadError) {
        return { success: false, error: uploadError.message }
      }

      const { data: urlData } = supabase.storage.from('videos').getPublicUrl(filename)
      return {
        success: true,
        url: urlData.publicUrl,
        script: scriptKey,
        format: format,
        noAudio: true
      }
    }

    // Schritt 4: Video + Audio mergen
    console.log(`[Genesis] Step 4: Merging video + audio...`)
    const finalPath = path.join(TEMP_DIR, `final_${format}_${Date.now()}.mp4`)

    // Audio-Länge ermitteln und Video entsprechend anpassen
    execSync(`ffmpeg -y -i "${mp4Path}" -i "${audioPath}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -shortest "${finalPath}"`, { stdio: 'inherit' })

    // Schritt 5: Zu Supabase hochladen
    console.log(`[Genesis] Step 5: Uploading to Supabase...`)
    const filename = `no-avatar-${format}-${Date.now()}.mp4`
    const buffer = fs.readFileSync(finalPath)

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(filename, buffer, { contentType: 'video/mp4', upsert: true })

    if (uploadError) {
      return { success: false, error: uploadError.message }
    }

    const { data: urlData } = supabase.storage.from('videos').getPublicUrl(filename)

    // Cleanup
    try {
      fs.unlinkSync(webmPath)
      fs.unlinkSync(mp4Path)
      fs.unlinkSync(audioPath)
      fs.unlinkSync(finalPath)
    } catch (e) { /* ignore cleanup errors */ }

    return {
      success: true,
      url: urlData.publicUrl,
      script: scriptKey,
      format: format,
      lang: lang
    }

  } catch (error) {
    console.error(`[Genesis] Website video creation failed:`, error)
    return { success: false, error: error.message }
  }
}

// TTS Audio generieren (OpenAI oder ElevenLabs)
async function generateTTSAudio(text, lang = 'en', outputPath) {
  console.log(`[Genesis] Generating TTS audio (${lang})...`)

  // OpenAI TTS (bevorzugt)
  const openaiKey = (process.env.OPENAI_API_KEY || '').trim()
  if (openaiKey) {
    try {
      const voice = lang === 'de' ? 'nova' : 'onyx' // nova für DE, onyx für EN
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: voice,
          input: text,
          response_format: 'mp3'
        })
      })

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer()
        fs.writeFileSync(outputPath, Buffer.from(audioBuffer))
        console.log(`[Genesis] TTS audio generated: ${outputPath}`)
        return { success: true, path: outputPath }
      }
    } catch (e) {
      console.log(`[Genesis] OpenAI TTS failed: ${e.message}`)
    }
  }

  // Fallback: HeyGen TTS (wenn vorhanden)
  const heygenKey = (process.env.HEYGEN_API_KEY || '').trim()
  if (heygenKey) {
    // HeyGen hat keinen reinen TTS-Endpoint, nur mit Avatar
    // Also kein Fallback hier
  }

  return { success: false, error: 'No TTS service available' }
}

// ============================================
// SCREEN RECORDING
// ============================================
async function recordBackground(demoType = 'demo') {
  console.log(`[Genesis] Recording background video: ${demoType}`)
  const recorder = new ScreenRecorder({ outputDir: TEMP_DIR })
  return await recorder.record(demoType)
}

// ============================================
// FFMPEG COMPOSITING
// ============================================
function downloadVideo(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath)
    https.get(url, (res) => {
      res.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve(outputPath)
      })
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {})
      reject(err)
    })
  })
}

function compositeVideos(backgroundPath, avatarPath, outputPath, useChromaKey = true) {
  console.log(`[Genesis] Compositing videos with FFmpeg...`)
  console.log(`  Background: ${backgroundPath}`)
  console.log(`  Avatar: ${avatarPath}`)
  console.log(`  Output: ${outputPath}`)
  console.log(`  Mode: ${useChromaKey ? 'Chroma-Key + Logo Overlay' : 'Simple PIP'}`)

  let ffmpegCmd

  if (useChromaKey) {
    console.log(`[Genesis] Applying green screen removal with colorkey filter...`)

    // COLORKEY Filter - zuverlässiger als chromakey
    // HeyGen verwendet reines Grün #00FF00
    // similarity=0.4 = aggressiv, blend=0.1 = weiche Kanten
    const filterComplex = [
      '[1:v]colorkey=0x00FF00:0.4:0.1,scale=300:-1[avatar_keyed]',
      '[0:v][avatar_keyed]overlay=W-w-10:H-h+80:shortest=1[with_avatar]',
      '[with_avatar]drawbox=x=W-170:y=H-35:w=165:h=30:color=black@0.95:t=fill,drawtext=text=EVIDENRA.com:fontcolor=white:fontsize=14:x=W-165:y=H-28[outv]'
    ].join(';')

    ffmpegCmd = `ffmpeg -y -i "${backgroundPath}" -i "${avatarPath}" -filter_complex "${filterComplex}" -map "[outv]" -map 1:a -c:v libx264 -preset fast -crf 21 -c:a aac -b:a 192k "${outputPath}"`
  } else {
    ffmpegCmd = `ffmpeg -y -i "${backgroundPath}" -i "${avatarPath}" -filter_complex "[1:v]scale=400:-1[avatar];[0:v][avatar]overlay=W-w-20:H-h-20:shortest=1[outv]" -map "[outv]" -map 1:a -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k "${outputPath}"`
  }

  try {
    console.log(`[Genesis] Running FFmpeg command...`)
    const result = execSync(ffmpegCmd, { stdio: 'pipe', timeout: 300000 })
    console.log(`[Genesis] Composite video created successfully: ${outputPath}`)
    return outputPath
  } catch (err) {
    console.error(`[Genesis] FFmpeg colorkey FAILED:`, err.message)
    console.error(`[Genesis] stderr:`, err.stderr?.toString() || 'no stderr')

    // Fallback 1: Versuche chromakey statt colorkey
    console.log(`[Genesis] Trying chromakey as fallback...`)
    const chromakeyFilter = [
      '[1:v]chromakey=green:0.4:0.1,scale=300:-1[avatar_keyed]',
      '[0:v][avatar_keyed]overlay=W-w-10:H-h+80:shortest=1[with_avatar]',
      '[with_avatar]drawbox=x=W-170:y=H-35:w=165:h=30:color=black@0.95:t=fill,drawtext=text=EVIDENRA.com:fontcolor=white:fontsize=14:x=W-165:y=H-28[outv]'
    ].join(';')

    const chromakeyCmd = `ffmpeg -y -i "${backgroundPath}" -i "${avatarPath}" -filter_complex "${chromakeyFilter}" -map "[outv]" -map 1:a -c:v libx264 -preset fast -crf 21 -c:a aac -b:a 192k "${outputPath}"`

    try {
      execSync(chromakeyCmd, { stdio: 'pipe', timeout: 300000 })
      console.log(`[Genesis] Chromakey fallback succeeded!`)
      return outputPath
    } catch (chromakeyErr) {
      console.error(`[Genesis] Chromakey also FAILED:`, chromakeyErr.message)

      // Fallback 2: Ohne Greenscreen - aber nur als letzte Option
      console.error(`[Genesis] Using simple overlay WITHOUT green screen removal`)
      const simpleCmd = `ffmpeg -y -i "${backgroundPath}" -i "${avatarPath}" -filter_complex "[1:v]scale=400:-1[avatar];[0:v][avatar]overlay=W-w-20:H-h-20:shortest=1[outv]" -map "[outv]" -map 1:a -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k "${outputPath}"`

      execSync(simpleCmd, { stdio: 'pipe', timeout: 300000 })
      console.log(`[Genesis] Simple overlay created (NO green removal)`)
      return outputPath
    }
  }
}

async function createFullVideo(topic = 'auto', demoType = 'demo') {
  console.log(`[Genesis] === FULL VIDEO PIPELINE v3.0 ===`)
  console.log(`  Topic: ${topic}`)
  console.log(`  Demo: ${demoType}`)
  console.log(`  Mode: HeyGen Video-Background (KEIN Chromakey!)`)

  // Schritt 1: Hintergrund-Video aufnehmen mit Playwright
  console.log(`[Genesis] Step 1: Recording EVIDENRA website...`)
  let backgroundPath
  try {
    backgroundPath = await recordBackground(demoType)
    console.log(`[Genesis] Background recorded: ${backgroundPath}`)
  } catch (err) {
    console.error(`[Genesis] Recording FAILED:`, err.message)
    // Fallback: Video ohne Hintergrund (normales HeyGen Video)
    console.log(`[Genesis] Falling back to standard HeyGen video...`)
    const fallbackResult = await createHeyGenVideo(topic, false)
    if (!fallbackResult.success) {
      const errStr = typeof fallbackResult.error === 'string' ? fallbackResult.error : JSON.stringify(fallbackResult.error)
      throw new Error(errStr || 'HeyGen fallback failed')
    }
    const avatarUrl = await waitForVideo(fallbackResult.videoId)
    return {
      videoPath: null,
      avatarUrl,
      avatar: fallbackResult.avatar,
      script: fallbackResult.script,
      mode: 'fallback'
    }
  }

  // Schritt 2: WebM zu MP4 konvertieren (HeyGen bevorzugt MP4)
  console.log(`[Genesis] Step 2: Converting to MP4...`)
  const mp4Path = backgroundPath.replace('.webm', '.mp4')
  try {
    execSync(`ffmpeg -y -i "${backgroundPath}" -c:v libx264 -preset fast -crf 23 "${mp4Path}"`, {
      stdio: 'pipe',
      timeout: 120000
    })
    fs.unlinkSync(backgroundPath) // WebM löschen
    backgroundPath = mp4Path
    console.log(`[Genesis] Converted to: ${mp4Path}`)
  } catch (err) {
    console.log(`[Genesis] Already MP4 or conversion not needed`)
  }

  // Schritt 3: Video zu Supabase hochladen (für HeyGen als URL)
  console.log(`[Genesis] Step 3: Uploading background to Supabase...`)
  const bgTimestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const bgFilename = `background-${bgTimestamp}.mp4`

  let backgroundUrl
  try {
    const videoBuffer = fs.readFileSync(backgroundPath)
    console.log(`[Genesis] Background size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`)

    const { data, error } = await supabase.storage
      .from('videos')
      .upload(bgFilename, videoBuffer, {
        contentType: 'video/mp4',
        upsert: true
      })

    if (error) {
      throw new Error(`Supabase upload error: ${error.message}`)
    }

    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(bgFilename)

    backgroundUrl = urlData.publicUrl
    console.log(`[Genesis] Background uploaded: ${backgroundUrl}`)

    // Lokale Datei löschen
    fs.unlinkSync(backgroundPath)
  } catch (err) {
    console.error(`[Genesis] Supabase upload FAILED:`, err.message)
    // Fallback: Standard HeyGen Video ohne Hintergrund
    console.log(`[Genesis] Falling back to standard HeyGen video...`)
    const fallbackResult = await createHeyGenVideo(topic, false)
    if (!fallbackResult.success) {
      const errFallback = typeof fallbackResult.error === 'string' ? fallbackResult.error : JSON.stringify(fallbackResult.error)
      throw new Error(errFallback || 'Fallback failed')
    }
    const avatarUrl = await waitForVideo(fallbackResult.videoId)
    return {
      videoPath: null,
      avatarUrl,
      avatar: fallbackResult.avatar,
      script: fallbackResult.script,
      mode: 'standard_fallback'
    }
  }

  // Schritt 4: HeyGen Video mit Supabase-URL als Hintergrund erstellen
  console.log(`[Genesis] Step 4: Creating HeyGen video with Supabase URL as background...`)
  const heygenResult = await createHeyGenVideoWithBackground(topic, backgroundUrl)

  if (!heygenResult.success) {
    const errHeygen = typeof heygenResult.error === 'string' ? heygenResult.error : JSON.stringify(heygenResult.error)
    throw new Error(errHeygen || 'HeyGen video with background failed')
  }

  // Schritt 5: Auf HeyGen warten
  console.log(`[Genesis] Step 5: Waiting for HeyGen to render...`)
  const finalVideoUrl = await waitForVideo(heygenResult.videoId)

  // Hintergrund-Video löschen (nicht mehr benötigt)
  if (fs.existsSync(backgroundPath)) {
    fs.unlinkSync(backgroundPath)
  }

  console.log(`[Genesis] === VIDEO COMPLETE ===`)
  console.log(`  Avatar: ${heygenResult.avatar}`)
  console.log(`  Script: ${heygenResult.script}`)
  console.log(`  Mode: HeyGen Video-Background (perfekte Freistellung!)`)

  return {
    videoPath: null,  // Video ist bei HeyGen, wird direkt heruntergeladen
    avatarUrl: finalVideoUrl,
    avatar: heygenResult.avatar,
    script: heygenResult.script,
    mode: 'heygen_video_background'
  }
}

// ============================================
// SUPABASE UPLOAD
// ============================================
async function downloadAndUploadToSupabase(videoUrl, filename) {
  console.log(`[Genesis] Downloading video from HeyGen...`)

  // Download video buffer
  const videoBuffer = await new Promise((resolve, reject) => {
    https.get(videoUrl, (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })

  console.log(`[Genesis] Downloaded ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`)

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('videos')
    .upload(filename, videoBuffer, {
      contentType: 'video/mp4',
      upsert: true
    })

  if (error) {
    throw new Error(`Supabase upload error: ${error.message}`)
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('videos')
    .getPublicUrl(filename)

  const publicUrl = urlData.publicUrl

  // Alte Videos loeschen (nur letztes behalten)
  console.log('[Genesis] Loesche alte Videos...')
  const { data: oldVideos } = await supabase
    .from('cloud_videos')
    .select('filename')
    .eq('is_latest', true)

  if (oldVideos && oldVideos.length > 0) {
    for (const video of oldVideos) {
      // Aus Storage loeschen
      await supabase.storage.from('videos').remove([video.filename])
      console.log(`[Genesis] Geloescht: ${video.filename}`)
    }
    // Aus Tabelle loeschen
    await supabase.from('cloud_videos').delete().eq('is_latest', true)
  }

  // Neues Video als latest markieren
  await supabase
    .from('cloud_videos')
    .insert({
      filename,
      url: publicUrl,
      is_latest: true,
      created_at: new Date().toISOString()
    })

  console.log(`[Genesis] Uploaded to Supabase: ${publicUrl}`)
  return publicUrl
}

// ============================================
// API ENDPOINTS
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'EVIDENRA Genesis Cloud',
    version: '3.6.1',  // Added API key trim + fallback auth
    authKeyPrefix: GENESIS_KEY.substring(0, 10) + '...',
    todaysScript: getDailyScript(),
    todaysDemoType: getDailyDemoType(),
    totalScripts: SCRIPT_KEYS.length
  })
})

// Aktuelles tägliches Script anzeigen
app.get('/today', (req, res) => {
  const daily = getDailyScript()
  res.json({
    date: new Date().toISOString().split('T')[0],
    script: daily.key,
    lang: daily.lang,
    text: daily.script,
    allScripts: SCRIPT_KEYS
  })
})

// Create new video
app.post('/create-video', async (req, res) => {
  const { topic = 'auto', waitForCompletion = true } = req.body
  const authHeader = req.headers.authorization

  // Simple API key auth
  if (!isValidKey(authHeader)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  console.log(`[Genesis] Creating video, topic: ${topic}`)

  try {
    const result = await createHeyGenVideo(topic)

    if (!result.success) {
      const errorMsg = typeof result.error === 'string'
        ? result.error
        : JSON.stringify(result.error) || 'HeyGen error'
      return res.status(500).json({ error: errorMsg })
    }

    if (!waitForCompletion) {
      return res.json({
        success: true,
        videoId: result.videoId,
        avatar: result.avatar,
        script: result.script,
        message: 'Video generation started. Use /status/:id to check progress.'
      })
    }

    // Wait for completion
    console.log(`[Genesis] Waiting for video ${result.videoId}...`)
    const videoUrl = await waitForVideo(result.videoId)

    // Upload to Supabase
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `genesis-${result.script}-${timestamp}.mp4`
    const supabaseUrl = await downloadAndUploadToSupabase(videoUrl, filename)

    res.json({
      success: true,
      videoId: result.videoId,
      avatar: result.avatar,
      script: result.script,
      heygenUrl: videoUrl,
      supabaseUrl,
      filename
    })

  } catch (e) {
    console.error('[Genesis] Error:', e)
    const errorMsg = e?.message || JSON.stringify(e) || 'Unknown error'
    res.status(500).json({ error: errorMsg })
  }
})

// Check video status
app.get('/status/:videoId', async (req, res) => {
  const { videoId } = req.params
  const status = await checkHeyGenStatus(videoId)
  res.json(status)
})

// List recent videos
app.get('/videos', async (req, res) => {
  const { data, error } = await supabase
    .from('cloud_videos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json(data)
})

// Create FULL video (Background Recording + HeyGen Video-Background)
app.post('/create-full-video', async (req, res) => {
  const { topic = 'auto', demoType = 'demo' } = req.body
  const authHeader = req.headers.authorization

  if (!isValidKey(authHeader)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  console.log(`[Genesis] === FULL VIDEO REQUEST v3.0 ===`)
  console.log(`  Topic: ${topic}, Demo: ${demoType}`)

  try {
    // Full Pipeline: Record → Upload to HeyGen → HeyGen renders with video background
    const result = await createFullVideo(topic, demoType)

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `genesis-full-${result.script}-${timestamp}.mp4`

    let videoBuffer

    // Neuer Flow: Video kommt direkt von HeyGen (avatarUrl)
    if (result.avatarUrl && !result.videoPath) {
      console.log(`[Genesis] Downloading final video from HeyGen...`)
      const rawBuffer = await new Promise((resolve, reject) => {
        https.get(result.avatarUrl, (res) => {
          const chunks = []
          res.on('data', chunk => chunks.push(chunk))
          res.on('end', () => resolve(Buffer.concat(chunks)))
          res.on('error', reject)
        }).on('error', reject)
      })
      console.log(`[Genesis] Downloaded ${(rawBuffer.length / 1024 / 1024).toFixed(2)} MB`)

      // EVIDENRA Logo über HeyGen Watermark legen
      console.log(`[Genesis] Adding EVIDENRA logo overlay...`)
      const tempInput = path.join(TEMP_DIR, `heygen-${Date.now()}.mp4`)
      const tempOutput = path.join(TEMP_DIR, `branded-${Date.now()}.mp4`)

      fs.writeFileSync(tempInput, rawBuffer)

      try {
        // Logo-Box unten rechts über HeyGen Watermark
        const logoCmd = `ffmpeg -y -i "${tempInput}" -filter_complex "drawbox=x=W-180:y=H-40:w=175:h=35:color=black@0.9:t=fill,drawtext=text='EVIDENRA.com':fontcolor=white:fontsize=16:x=W-170:y=H-32" -c:v libx264 -preset fast -crf 21 -c:a copy "${tempOutput}"`
        execSync(logoCmd, { stdio: 'pipe', timeout: 120000 })
        videoBuffer = fs.readFileSync(tempOutput)
        console.log(`[Genesis] Logo overlay added successfully`)
      } catch (err) {
        console.log(`[Genesis] Logo overlay failed, using original: ${err.message}`)
        videoBuffer = rawBuffer
      }

      // Cleanup temp files
      if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput)
      if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput)

    } else if (result.videoPath && fs.existsSync(result.videoPath)) {
      // Alter Flow: Lokale Datei
      console.log(`[Genesis] Reading local video file...`)
      videoBuffer = fs.readFileSync(result.videoPath)
      fs.unlinkSync(result.videoPath)
    } else {
      throw new Error('No video available in result')
    }

    // Upload to Supabase
    console.log(`[Genesis] Uploading to Supabase...`)
    const { data, error } = await supabase.storage
      .from('videos')
      .upload(filename, videoBuffer, {
        contentType: 'video/mp4',
        upsert: true
      })

    if (error) {
      throw new Error(`Supabase upload error: ${error.message}`)
    }

    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(filename)

    const supabaseUrl = urlData.publicUrl

    // Alte Videos loeschen
    const { data: oldVideos } = await supabase
      .from('cloud_videos')
      .select('filename')
      .eq('is_latest', true)

    if (oldVideos && oldVideos.length > 0) {
      for (const video of oldVideos) {
        await supabase.storage.from('videos').remove([video.filename])
      }
      await supabase.from('cloud_videos').delete().eq('is_latest', true)
    }

    await supabase.from('cloud_videos').insert({
      filename,
      url: supabaseUrl,
      is_latest: true,
      created_at: new Date().toISOString()
    })

    res.json({
      success: true,
      mode: result.mode || 'heygen_video_background',
      avatar: result.avatar,
      script: result.script,
      supabaseUrl,
      filename
    })

  } catch (e) {
    console.error('[Genesis] Full video error:', e)
    const errorMsg = typeof e === 'string' ? e : (e?.message || JSON.stringify(e) || 'Unknown error')
    res.status(500).json({ error: errorMsg })
  }
})

// ============================================
// MULTI-FORMAT VIDEO CREATION (MIT WEBSITE-HINTERGRUND!)
// ============================================
app.post('/create-multi-format', async (req, res) => {
  const { topic = 'auto', formats = ['youtube', 'tiktok', 'instagram'] } = req.body
  const authHeader = req.headers.authorization

  if (!isValidKey(authHeader)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  console.log('[Genesis] === MULTI-FORMAT WITH WEBSITE BACKGROUND ===')
  console.log('[Genesis] Formats:', formats.join(', '))

  const results = {}
  const daily = getDailyScript()
  const demoType = getDailyDemoType ? getDailyDemoType() : 'demo'

  // Viewport-Größen für verschiedene Formate
  const FORMAT_VIEWPORTS = {
    'youtube': { width: 1280, height: 720 },
    'tiktok': { width: 720, height: 1280 },
    'instagram': { width: 720, height: 720 },
    'twitter': { width: 1280, height: 720 }
  }

  for (const format of formats) {
    console.log(`\n[Genesis] === Processing format: ${format} ===`)
    try {
      let heygenAssetUrl
      let bgFilename = null  // Nur gesetzt wenn wir uploaden mussten

      // Prüfe ob App-Demo (pre-recorded) oder Website (live recording)
      if (APP_DEMO_VIDEOS[demoType]) {
        // App-Demo: Nutze pre-recorded Video
        heygenAssetUrl = APP_DEMO_VIDEOS[demoType]
        console.log(`[Genesis] Using pre-recorded app demo: ${demoType}`)
        console.log(`[Genesis] URL: ${heygenAssetUrl}`)
      } else {
        // Website-Demo: Live aufnehmen
        const viewport = FORMAT_VIEWPORTS[format] || FORMAT_VIEWPORTS.youtube
        console.log(`[Genesis] Recording website at ${viewport.width}x${viewport.height}...`)

        const recorder = new ScreenRecorder({
          outputDir: TEMP_DIR,
          width: viewport.width,
          height: viewport.height
        })

        let backgroundPath
        try {
          backgroundPath = await recorder.record(demoType)
          console.log(`[Genesis] Background recorded: ${backgroundPath}`)
        } catch (recErr) {
          console.error(`[Genesis] Recording failed for ${format}:`, recErr.message)
          results[format] = { success: false, error: `Recording failed: ${recErr.message}` }
          continue
        }

        // WebM zu MP4 konvertieren
        const mp4Path = backgroundPath.replace('.webm', '.mp4')
        try {
          execSync(`ffmpeg -y -i "${backgroundPath}" -c:v libx264 -preset fast -crf 23 "${mp4Path}"`, {
            stdio: 'pipe',
            timeout: 120000
          })
          if (fs.existsSync(backgroundPath)) fs.unlinkSync(backgroundPath)
          backgroundPath = mp4Path
        } catch (convErr) {
          console.log(`[Genesis] Conversion skipped or failed, using original`)
        }

        // Background zu Supabase hochladen für HeyGen URL
        console.log(`[Genesis] Uploading background to Supabase...`)
        const bgTimestamp = Date.now()
        bgFilename = `background-${format}-${bgTimestamp}.mp4`

        try {
          const videoBuffer = fs.readFileSync(backgroundPath)
          console.log(`[Genesis] Background size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`)

          const { error: uploadError } = await supabase.storage
            .from('videos')
            .upload(bgFilename, videoBuffer, { contentType: 'video/mp4', upsert: true })

          if (uploadError) throw new Error(`Supabase upload error: ${uploadError.message}`)

          const { data: urlData } = supabase.storage.from('videos').getPublicUrl(bgFilename)
          heygenAssetUrl = urlData.publicUrl
          console.log(`[Genesis] Background URL for HeyGen: ${heygenAssetUrl}`)

          // Lokale Datei löschen
          if (fs.existsSync(backgroundPath)) fs.unlinkSync(backgroundPath)
        } catch (uploadErr) {
          console.error(`[Genesis] Upload failed for ${format}:`, uploadErr.message)
          if (fs.existsSync(backgroundPath)) fs.unlinkSync(backgroundPath)
          results[format] = { success: false, error: `Upload failed: ${uploadErr.message}` }
          continue
        }
      }

      // Schritt 4: HeyGen Video MIT Background URL erstellen
      console.log(`[Genesis] Creating HeyGen video with background URL...`)
      const heygenResult = await createHeyGenVideoWithBackground(topic, heygenAssetUrl, format)

      if (!heygenResult.success) {
        results[format] = { success: false, error: heygenResult.error }
        // Background löschen (nur wenn wir es hochgeladen haben)
        if (bgFilename) await supabase.storage.from('videos').remove([bgFilename])
        continue
      }

      // Schritt 5: Auf HeyGen warten
      console.log(`[Genesis] Waiting for HeyGen to render ${format}...`)
      let status = { status: 'processing' }
      let attempts = 0
      while (status.status === 'processing' && attempts < 80) {
        await new Promise(r => setTimeout(r, 5000))
        status = await checkHeyGenStatus(heygenResult.videoId)
        console.log(`[Genesis] ${format} status: ${status.status} (attempt ${attempts + 1})`)
        attempts++
      }

      if (status.status === 'completed' && status.videoUrl) {
        // Schritt 6: Fertiges Video herunterladen und zu Supabase hochladen
        console.log(`[Genesis] Downloading final ${format} video...`)
        const videoBuffer = await new Promise((resolve, reject) => {
          https.get(status.videoUrl, (res) => {
            const chunks = []
            res.on('data', chunk => chunks.push(chunk))
            res.on('end', () => resolve(Buffer.concat(chunks)))
            res.on('error', reject)
          }).on('error', reject)
        })

        const finalFilename = `genesis-${format}-${heygenResult.script}-${Date.now()}.mp4`
        const { error: finalUploadError } = await supabase.storage
          .from('videos')
          .upload(finalFilename, videoBuffer, {
            contentType: 'video/mp4',
            upsert: true
          })

        if (finalUploadError) {
          console.error(`[Genesis] Final upload failed:`, finalUploadError.message)
          results[format] = { success: false, error: finalUploadError.message }
        } else {
          const { data: finalUrlData } = supabase.storage
            .from('videos')
            .getPublicUrl(finalFilename)

          console.log(`[Genesis] ${format} complete: ${finalUrlData.publicUrl}`)
          results[format] = {
            success: true,
            url: finalUrlData.publicUrl,
            script: heygenResult.script,
            avatar: heygenResult.avatar
          }
        }

        // Background-Video löschen (nur wenn wir es hochgeladen haben)
        if (bgFilename) await supabase.storage.from('videos').remove([bgFilename])
      } else {
        results[format] = { success: false, error: status.error || 'HeyGen timeout' }
        if (bgFilename) await supabase.storage.from('videos').remove([bgFilename])
      }

    } catch (e) {
      console.error(`[Genesis] Error for ${format}:`, e.message)
      results[format] = { success: false, error: e.message }
    }
  }

  console.log('\n[Genesis] === MULTI-FORMAT COMPLETE ===')
  console.log('[Genesis] Results:', JSON.stringify(results, null, 2))

  res.json({
    success: true,
    script: daily.script,
    scriptKey: daily.key,
    lang: daily.lang,
    results
  })
})

// Get formats info
app.get('/formats', (req, res) => {
  res.json({ formats: VIDEO_FORMATS, scripts: SCRIPT_KEYS, total: SCRIPT_KEYS.length })
})

// ============================================
// DAILY AUTOPILOT - Vollautomatisches Marketing
// ============================================
// Telegram + Discord Notifications
async function sendTelegramNotification(message) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim()
  const chatId = (process.env.TELEGRAM_CHAT_ID || '7804985180').trim()
  if (!token) return console.log('[Autopilot] No TELEGRAM_BOT_TOKEN')

  return new Promise((resolve) => {
    const payload = JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    })

    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(true))
    })
    req.on('error', () => resolve(false))
    req.write(payload)
    req.end()
  })
}

async function sendDiscordNotification(message) {
  const webhookUrl = (process.env.DISCORD_WEBHOOK_URL || '').trim()
  if (!webhookUrl) return console.log('[Autopilot] No DISCORD_WEBHOOK_URL')

  const url = new URL(webhookUrl)
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      content: message,
      username: 'EVIDENRA Autopilot'
    })

    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      res.on('data', () => {})
      res.on('end', () => resolve(true))
    })
    req.on('error', () => resolve(false))
    req.write(payload)
    req.end()
  })
}

// ============================================
// YOUTUBE UPLOAD
// ============================================
async function uploadToYouTube(videoUrl, title, description) {
  const clientId = (process.env.YOUTUBE_CLIENT_ID || '').trim()
  const clientSecret = (process.env.YOUTUBE_CLIENT_SECRET || '').trim()
  const refreshToken = (process.env.YOUTUBE_REFRESH_TOKEN || '').trim()

  if (!clientId || !refreshToken) {
    console.log('[YouTube] Missing credentials')
    return { success: false, error: 'YouTube not configured' }
  }

  try {
    // 1. Refresh Access Token
    console.log('[YouTube] Refreshing access token...')
    const tokenBody = `refresh_token=${encodeURIComponent(refreshToken)}&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret || '')}&grant_type=refresh_token`

    const tokenResult = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try { resolve(JSON.parse(data)) } catch { resolve({}) }
        })
      })
      req.on('error', reject)
      req.write(tokenBody)
      req.end()
    })

    if (!tokenResult.access_token) {
      return { success: false, error: 'Token refresh failed' }
    }
    console.log('[YouTube] Token refreshed')

    // 2. Download video
    console.log('[YouTube] Downloading video...')
    const videoBuffer = await new Promise((resolve, reject) => {
      https.get(videoUrl, (res) => {
        const chunks = []
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      }).on('error', reject)
    })
    console.log('[YouTube] Video downloaded:', videoBuffer.length, 'bytes')

    // 3. Init resumable upload
    const metadata = {
      snippet: {
        title: title,
        description: description,
        tags: ['EVIDENRA', 'Qualitative Research', 'AI', 'PhD', 'Academia'],
        categoryId: '28'
      },
      status: { privacyStatus: 'public', selfDeclaredMadeForKids: false }
    }

    const uploadUrl = await new Promise((resolve) => {
      const req = https.request({
        hostname: 'www.googleapis.com',
        path: '/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenResult.access_token}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Length': videoBuffer.length,
          'X-Upload-Content-Type': 'video/mp4'
        }
      }, (res) => {
        resolve(res.headers['location'] || null)
      })
      req.on('error', () => resolve(null))
      req.write(JSON.stringify(metadata))
      req.end()
    })

    if (!uploadUrl) {
      return { success: false, error: 'Upload init failed' }
    }
    console.log('[YouTube] Upload initialized')

    // 4. Upload video
    const url = new URL(uploadUrl)
    const uploadResult = await new Promise((resolve) => {
      const req = https.request({
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': videoBuffer.length
        }
      }, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try { resolve(JSON.parse(data)) } catch { resolve(null) }
        })
      })
      req.on('error', () => resolve(null))
      req.write(videoBuffer)
      req.end()
    })

    if (uploadResult && uploadResult.id) {
      const youtubeUrl = `https://www.youtube.com/watch?v=${uploadResult.id}`
      console.log('[YouTube] Upload success:', youtubeUrl)
      return { success: true, youtubeUrl, videoId: uploadResult.id }
    }

    return { success: false, error: 'Upload failed' }
  } catch (e) {
    console.error('[YouTube] Error:', e.message)
    return { success: false, error: e.message }
  }
}

// ============================================
// TWITTER POST
// ============================================
const crypto = require('crypto')

function twitterOAuth(method, url, params = {}) {
  const oauth = {
    oauth_consumer_key: (process.env.TWITTER_API_KEY || '').trim(),
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: (process.env.TWITTER_ACCESS_TOKEN || '').trim(),
    oauth_version: '1.0'
  }

  const allParams = { ...oauth, ...params }
  const sortedParams = Object.keys(allParams).sort().map(k =>
    `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`
  ).join('&')

  const baseString = [method, encodeURIComponent(url), encodeURIComponent(sortedParams)].join('&')
  const signingKey = `${encodeURIComponent((process.env.TWITTER_API_SECRET || '').trim())}&${encodeURIComponent((process.env.TWITTER_ACCESS_TOKEN_SECRET || '').trim())}`
  oauth.oauth_signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64')

  return 'OAuth ' + Object.keys(oauth).sort().map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauth[k])}"`).join(', ')
}

async function postToTwitter(text) {
  if (!process.env.TWITTER_API_KEY) {
    return { success: false, error: 'Twitter not configured' }
  }

  try {
    const tweetUrl = 'https://api.twitter.com/2/tweets'
    const auth = twitterOAuth('POST', tweetUrl)

    const result = await new Promise((resolve) => {
      const req = https.request({
        hostname: 'api.twitter.com',
        path: '/2/tweets',
        method: 'POST',
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/json'
        }
      }, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try { resolve(JSON.parse(data)) } catch { resolve({}) }
        })
      })
      req.on('error', () => resolve({}))
      req.write(JSON.stringify({ text }))
      req.end()
    })

    if (result.data && result.data.id) {
      const tweetUrl = `https://twitter.com/evidenra/status/${result.data.id}`
      console.log('[Twitter] Posted:', tweetUrl)
      return { success: true, tweetUrl }
    }
    console.log('[Twitter] Failed:', JSON.stringify(result))
    return { success: false, error: JSON.stringify(result) }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ============================================
// PLATFORM-SPECIFIC SCRIPTS
// ============================================
async function generatePlatformScripts(scriptKey, scriptText, youtubeUrl, videoUrls) {
  const anthropicKey = (process.env.ANTHROPIC_API_KEY || '').trim()
  if (!anthropicKey) {
    // Fallback ohne AI
    return {
      instagram: `📸 INSTAGRAM\n📹 ${videoUrls.instagram}\n\n${scriptText}\n\n#QualitativeResearch #PhD #AI`,
      tiktok: `🎵 TIKTOK\n📹 ${videoUrls.tiktok}\n\n${scriptText}\n\n#PhDTok #ThesisTok`,
      linkedin: `💼 LINKEDIN\n📹 ${videoUrls.youtube}\n\n${scriptText}\n\n#Research #Academia`,
      facebook: `📘 FACEBOOK\n📹 ${videoUrls.youtube}\n\n${scriptText}`,
      reddit: `🔴 REDDIT\nTitle: ${scriptKey}\n\n${scriptText}`
    }
  }

  try {
    const prompt = `Generate social media posts for EVIDENRA marketing. Script: "${scriptText}"
YouTube: ${youtubeUrl}
Instagram Video (1:1): ${videoUrls.instagram}
TikTok Video (9:16): ${videoUrls.tiktok}

Reply ONLY with JSON (no other text):
{
  "instagram": "📸 INSTAGRAM\\n📹 Video: [url]\\n\\n[3-5 catchy sentences with emojis, include video URL]\\n\\nLink in bio 👆\\n\\n#QualitativeResearch #PhD",
  "tiktok": "🎵 TIKTOK\\n📹 Video: [url]\\n\\n[POV style hook, include video URL]\\n\\n#PhDTok #ThesisTok",
  "linkedin": "💼 LINKEDIN\\n📹 Video: [url]\\n\\n[Professional post with bullets, include video URL]\\n\\n#Research",
  "facebook": "📘 FACEBOOK\\n📹 Video: [url]\\n\\n[Friendly conversational post, include video URL]",
  "reddit": "🔴 REDDIT\\nTitle: [catchy title]\\nSubreddits: r/QualitativeResearch, r/PhD\\n\\n[Authentic helpful post]"
}`

    const response = await new Promise((resolve) => {
      const payload = JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })

      const req = https.request({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01'
        }
      }, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try { resolve(JSON.parse(data)) } catch { resolve({}) }
        })
      })
      req.on('error', () => resolve({}))
      req.write(payload)
      req.end()
    })

    if (response.content && response.content[0] && response.content[0].text) {
      const text = response.content[0].text.replace(/```json\n?|\n?```/g, '').trim()
      return JSON.parse(text)
    }
  } catch (e) {
    console.log('[Scripts] AI error:', e.message)
  }

  // Fallback
  return {
    instagram: `📸 INSTAGRAM\n📹 ${videoUrls.instagram}\n\n${scriptText}\n\n#QualitativeResearch #PhD`,
    tiktok: `🎵 TIKTOK\n📹 ${videoUrls.tiktok}\n\n${scriptText}\n\n#PhDTok`,
    linkedin: `💼 LINKEDIN\n📹 ${videoUrls.youtube}\n\n${scriptText}`,
    facebook: `📘 FACEBOOK\n📹 ${videoUrls.youtube}\n\n${scriptText}`,
    reddit: `🔴 REDDIT\nTitle: ${scriptKey}\n\n${scriptText}`
  }
}

app.post('/daily-autopilot', async (req, res) => {
  const authHeader = req.headers.authorization

  if (!isValidKey(authHeader)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  console.log('[Autopilot] === DAILY AUTOPILOT STARTED ===')
  const startTime = Date.now()
  const daily = getDailyScript()

  // Sofort antworten, dann im Hintergrund weiterarbeiten
  res.json({
    success: true,
    message: 'Autopilot started',
    script: daily.key,
    lang: daily.lang
  })

  try {
    // Schritt 1: Multi-Format Videos erstellen
    console.log('[Autopilot] Creating multi-format videos...')
    await sendTelegramNotification(`🎬 *AUTOPILOT GESTARTET*\n\nScript: ${daily.key}\nSprache: ${daily.lang.toUpperCase()}\n\n⏳ Erstelle Videos...`)

    const formats = ['youtube', 'tiktok', 'instagram']
    const results = {}
    const demoType = getDailyDemoType ? getDailyDemoType() : 'homepage'

    // Viewport-Größen für verschiedene Formate
    const FORMAT_VIEWPORTS = {
      'youtube': { width: 1280, height: 720 },
      'tiktok': { width: 720, height: 1280 },
      'instagram': { width: 720, height: 720 }
    }

    for (const format of formats) {
      console.log(`[Autopilot] === Creating ${format} video WITH WEBSITE BACKGROUND ===`)
      try {
        let heygenAssetUrl
        let bgFilename = null

        // Website aufnehmen
        const viewport = FORMAT_VIEWPORTS[format] || FORMAT_VIEWPORTS.youtube
        console.log(`[Autopilot] Recording website at ${viewport.width}x${viewport.height}...`)

        const recorder = new ScreenRecorder({
          outputDir: TEMP_DIR,
          width: viewport.width,
          height: viewport.height
        })

        let backgroundPath
        try {
          backgroundPath = await recorder.record(demoType)
          console.log(`[Autopilot] Background recorded: ${backgroundPath}`)
        } catch (recErr) {
          console.error(`[Autopilot] Recording failed for ${format}:`, recErr.message)
          results[format] = { success: false, error: `Recording failed: ${recErr.message}` }
          continue
        }

        // WebM zu MP4 konvertieren
        const mp4Path = backgroundPath.replace('.webm', '.mp4')
        try {
          execSync(`ffmpeg -y -i "${backgroundPath}" -c:v libx264 -preset fast -crf 23 "${mp4Path}"`, {
            stdio: 'pipe',
            timeout: 120000
          })
          if (fs.existsSync(backgroundPath)) fs.unlinkSync(backgroundPath)
          backgroundPath = mp4Path
        } catch (convErr) {
          console.log(`[Autopilot] Conversion skipped, using original`)
        }

        // Background zu Supabase hochladen
        console.log(`[Autopilot] Uploading background to Supabase...`)
        bgFilename = `autopilot-bg-${format}-${Date.now()}.mp4`

        try {
          const bgBuffer = fs.readFileSync(backgroundPath)
          const { error: uploadError } = await supabase.storage
            .from('videos')
            .upload(bgFilename, bgBuffer, { contentType: 'video/mp4', upsert: true })

          if (uploadError) throw new Error(uploadError.message)

          const { data: urlData } = supabase.storage.from('videos').getPublicUrl(bgFilename)
          heygenAssetUrl = urlData.publicUrl
          console.log(`[Autopilot] Background URL: ${heygenAssetUrl}`)

          if (fs.existsSync(backgroundPath)) fs.unlinkSync(backgroundPath)
        } catch (uploadErr) {
          console.error(`[Autopilot] Upload failed:`, uploadErr.message)
          if (fs.existsSync(backgroundPath)) fs.unlinkSync(backgroundPath)
          results[format] = { success: false, error: uploadErr.message }
          continue
        }

        // HeyGen Video MIT Background erstellen
        console.log(`[Autopilot] Creating HeyGen video with website background...`)
        const heygenResult = await createHeyGenVideoWithBackground(daily.key, heygenAssetUrl, format)

        if (!heygenResult.success) {
          results[format] = { success: false, error: heygenResult.error }
          if (bgFilename) await supabase.storage.from('videos').remove([bgFilename])
          continue
        }

        // Auf HeyGen warten
        console.log(`[Autopilot] Waiting for HeyGen to render ${format}...`)
        let status = { status: 'processing' }
        let attempts = 0
        while (status.status === 'processing' && attempts < 80) {
          await new Promise(r => setTimeout(r, 5000))
          status = await checkHeyGenStatus(heygenResult.videoId)
          console.log(`[Autopilot] ${format}: ${status.status} (${attempts + 1}/80)`)
          attempts++
        }

        // Background löschen (nicht mehr benötigt)
        if (bgFilename) await supabase.storage.from('videos').remove([bgFilename])

        if (status.status === 'completed' && status.videoUrl) {
          // Fertiges Video herunterladen und zu Supabase hochladen
          console.log(`[Autopilot] Downloading final ${format} video...`)
          const videoBuffer = await new Promise((resolve, reject) => {
            https.get(status.videoUrl, (res) => {
              const chunks = []
              res.on('data', chunk => chunks.push(chunk))
              res.on('end', () => resolve(Buffer.concat(chunks)))
              res.on('error', reject)
            }).on('error', reject)
          })

          const filename = `autopilot-${format}-${daily.key}-${Date.now()}.mp4`
          const { error } = await supabase.storage
            .from('videos')
            .upload(filename, videoBuffer, { contentType: 'video/mp4', upsert: true })

          if (!error) {
            const { data: urlData } = supabase.storage.from('videos').getPublicUrl(filename)
            results[format] = { success: true, url: urlData.publicUrl }
            console.log(`[Autopilot] ✅ ${format} complete: ${urlData.publicUrl}`)
          } else {
            results[format] = { success: false, error: error.message }
          }
        } else {
          results[format] = { success: false, error: status.error || 'Timeout' }
        }
      } catch (e) {
        results[format] = { success: false, error: e.message }
      }
    }

    // Schritt 2: YouTube Upload (16:9 Video)
    let youtubeResult = { success: false }
    if (results.youtube && results.youtube.success) {
      console.log('[Autopilot] Uploading to YouTube...')
      await sendTelegramNotification('📤 Lade zu YouTube hoch...')

      const today = new Date()
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const title = `EVIDENRA AI Research Tool | ${dayNames[today.getDay()]} Demo | 60% OFF`
      const description = `EVIDENRA - AI-Powered Qualitative Research

${daily.script}

✅ 7 AI Personas for reliable analysis
✅ Automatic theme identification
✅ Publication-ready exports

60% OFF for Founding Members: https://evidenra.com/pricing

#EVIDENRA #QualitativeResearch #AI #PhD`

      youtubeResult = await uploadToYouTube(results.youtube.url, title, description)
      if (youtubeResult.success) {
        console.log('[Autopilot] YouTube uploaded:', youtubeResult.youtubeUrl)
      }
    }

    // Schritt 3: Twitter Post
    let twitterResult = { success: false }
    const youtubeUrl = youtubeResult.youtubeUrl || results.youtube?.url || ''
    if (youtubeUrl) {
      console.log('[Autopilot] Posting to Twitter...')
      const tweetText = `🚀 New EVIDENRA Demo!

AI-powered qualitative research:
✅ Automatic interview analysis
✅ 7-Persona AKIH method

60% OFF: evidenra.com/pricing

📺 ${youtubeUrl}

#QualitativeResearch #AI #PhD`

      twitterResult = await postToTwitter(tweetText)
    }

    // Schritt 4: Platform-spezifische Scripts generieren
    console.log('[Autopilot] Generating platform scripts...')
    const videoUrls = {
      youtube: results.youtube?.url || '',
      tiktok: results.tiktok?.url || '',
      instagram: results.instagram?.url || ''
    }
    const platformScripts = await generatePlatformScripts(daily.key, daily.script, youtubeUrl, videoUrls)

    // Schritt 5: Finale Notifications senden
    const successCount = Object.values(results).filter(r => r.success).length
    const duration = Math.round((Date.now() - startTime) / 1000 / 60)

    // Header Message
    let headerMsg = `🎬 *EVIDENRA AUTOPILOT FERTIG!*\n\n`
    headerMsg += `📌 Script: ${daily.key}\n`
    headerMsg += `✅ Videos: ${successCount}/${formats.length}\n`
    headerMsg += `⏱ Dauer: ${duration} Minuten\n\n`

    if (youtubeResult.success) {
      headerMsg += `📺 *YOUTUBE*: ${youtubeResult.youtubeUrl}\n`
    }
    if (twitterResult.success) {
      headerMsg += `🐦 *TWITTER*: ${twitterResult.tweetUrl}\n`
    }
    headerMsg += `\n📹 *VIDEO DATEIEN:*\n`
    for (const [format, result] of Object.entries(results)) {
      if (result.success) {
        headerMsg += `• ${format.toUpperCase()}: ${result.url}\n`
      }
    }

    await sendTelegramNotification(headerMsg)
    await sendDiscordNotification(headerMsg.replace(/\*/g, '**'))

    // Platform Scripts als separate Nachrichten
    await new Promise(r => setTimeout(r, 2000))
    await sendTelegramNotification(`━━━━━━━━━━━━━━━━━━━━\n${platformScripts.instagram}`)
    await sendDiscordNotification(`━━━━━━━━━━━━━━━━━━━━\n${platformScripts.instagram}`)

    await new Promise(r => setTimeout(r, 2000))
    await sendTelegramNotification(`━━━━━━━━━━━━━━━━━━━━\n${platformScripts.tiktok}`)
    await sendDiscordNotification(`━━━━━━━━━━━━━━━━━━━━\n${platformScripts.tiktok}`)

    await new Promise(r => setTimeout(r, 2000))
    await sendTelegramNotification(`━━━━━━━━━━━━━━━━━━━━\n${platformScripts.linkedin}`)
    await sendDiscordNotification(`━━━━━━━━━━━━━━━━━━━━\n${platformScripts.linkedin}`)

    await new Promise(r => setTimeout(r, 2000))
    await sendTelegramNotification(`━━━━━━━━━━━━━━━━━━━━\n${platformScripts.facebook}`)
    await sendDiscordNotification(`━━━━━━━━━━━━━━━━━━━━\n${platformScripts.facebook}`)

    await new Promise(r => setTimeout(r, 2000))
    await sendTelegramNotification(`━━━━━━━━━━━━━━━━━━━━\n${platformScripts.reddit}`)
    await sendDiscordNotification(`━━━━━━━━━━━━━━━━━━━━\n${platformScripts.reddit}`)

    console.log('[Autopilot] === AUTOPILOT COMPLETE ===')
    console.log(`[Autopilot] Duration: ${duration} minutes`)
    console.log(`[Autopilot] Videos: ${successCount}/${formats.length}, YouTube: ${youtubeResult.success}, Twitter: ${twitterResult.success}`)

  } catch (e) {
    console.error('[Autopilot] Error:', e.message)
    await sendTelegramNotification(`❌ *AUTOPILOT FEHLER*\n\n${e.message}`)
  }
})

// ============================================
// START SERVER v3.4.0
// ============================================
app.listen(PORT, () => {
  console.log('[Genesis Cloud v3.4.0] Running on port', PORT)
  console.log('  Scripts:', SCRIPT_KEYS.length, '| Formats: youtube, tiktok, instagram, twitter')
  console.log('  NEW: Multi-format WITH website background recording!')
  console.log('  Demo today:', getDailyDemoType())
})
