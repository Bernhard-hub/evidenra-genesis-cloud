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

// Temp-Ordner erstellen
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true })
}

// Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// ============================================
// AVATARE MIT PASSENDEN STIMMEN
// ============================================
// MODERNE Avatare - expressive Versionen (jung & professionell)
const AVATARS_FEMALE = [
  { id: 'Annie_expressive_public', name: 'Annie', gender: 'female' },
  { id: 'Annie_expressive2_public', name: 'Annie Style 2', gender: 'female' },
  { id: 'Aubrey_expressive_2024112701', name: 'Aubrey', gender: 'female' },
  { id: 'Anna_public_3_20240108', name: 'Anna', gender: 'female' }
]

const AVATARS_MALE = [
  { id: 'Albert_public_1', name: 'Albert', gender: 'male' },
  { id: 'Albert_public_2', name: 'Albert Style 2', gender: 'male' },
  { id: 'Adrian_public_20240312', name: 'Adrian', gender: 'male' }
]

// Alle Avatare kombiniert
const AVATARS = [...AVATARS_FEMALE, ...AVATARS_MALE]

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

// Tägliches Script basierend auf Datum
function getDailyScript() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
  const index = dayOfYear % SCRIPT_KEYS.length
  const key = SCRIPT_KEYS[index]
  const isGerman = SCRIPTS_DE[key] !== undefined
  return { key, lang: isGerman ? 'de' : 'en', script: ALL_SCRIPTS[key] }
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
  const apiKey = process.env.HEYGEN_API_KEY
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
  const apiKey = process.env.HEYGEN_API_KEY
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

  const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)]

  // Greenscreen für Compositing, sonst normale Hintergrundfarbe
  const background = useGreenscreen ? GREENSCREEN_BACKGROUND : getRandomBackground()

  // WICHTIG: Stimme passend zum Avatar-Geschlecht UND Sprache!
  // Deutsche Stimmen für DE, englische für EN
  const voice = VOICES[avatar.gender] || VOICES.female

  console.log(`[Genesis] Creating video:`)
  console.log(`  - Script: ${scriptKey} (${lang.toUpperCase()})`)
  console.log(`  - Avatar: ${avatar.name} (${avatar.gender})`)
  console.log(`  - Voice: ${avatar.gender}`)
  console.log(`  - Format: ${formatConfig.name} (${formatConfig.aspect})`)
  console.log(`  - Background: ${useGreenscreen ? 'GREENSCREEN' : background.value}`)

  const payload = JSON.stringify({
    video_inputs: [{
      character: {
        type: 'avatar',
        avatar_id: avatar.id,
        avatar_style: 'normal',
        scale: format === 'tiktok' ? 1.0 : 0.85  // Größer für Portrait
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
  const apiKey = process.env.HEYGEN_API_KEY

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
  const apiKey = process.env.HEYGEN_API_KEY
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
async function createHeyGenVideoWithBackground(topic = 'auto', videoUrl) {
  const apiKey = process.env.HEYGEN_API_KEY
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

  console.log(`[Genesis] Creating video WITH VIDEO URL BACKGROUND:`)
  console.log(`  - Script: ${scriptKey} (${lang.toUpperCase()})`)
  console.log(`  - Avatar: ${avatar.name} (${avatar.gender})`)
  console.log(`  - Background: ${videoUrl}`)

  const payload = JSON.stringify({
    video_inputs: [{
      character: {
        type: 'avatar',
        avatar_id: avatar.id,
        avatar_style: 'normal',
        scale: 0.45,  // Avatar etwas kleiner
        offset: {
          x: 0.35,   // Nach rechts (0 = mitte, 0.5 = ganz rechts)
          y: 0.35    // Nach unten (0 = mitte, 0.5 = ganz unten)
        }
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
    dimension: { width: 1280, height: 720 },
    aspect_ratio: '16:9'
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
    version: '3.2.2',  // Complete error serialization
    todaysScript: getDailyScript(),
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
  if (authHeader !== `Bearer ${process.env.GENESIS_API_KEY}`) {
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

  if (authHeader !== `Bearer ${process.env.GENESIS_API_KEY}`) {
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
// MULTI-FORMAT VIDEO CREATION
// ============================================
app.post('/create-multi-format', async (req, res) => {
  const { topic = 'auto', formats = ['youtube', 'tiktok', 'instagram'] } = req.body
  const authHeader = req.headers.authorization

  if (authHeader !== `Bearer ${process.env.GENESIS_API_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  console.log('[Genesis] MULTI-FORMAT:', topic, '->', formats.join(', '))
  const results = {}
  const daily = getDailyScript()

  for (const format of formats) {
    try {
      const result = await createHeyGenVideo(topic, false, format)
      if (result.success && result.videoId) {
        let status = { status: 'processing' }
        let attempts = 0
        while (status.status === 'processing' && attempts < 60) {
          await new Promise(r => setTimeout(r, 5000))
          status = await checkHeyGenStatus(result.videoId)
          attempts++
        }
        if (status.videoUrl) {
          const videoBuffer = await new Promise((resolve, reject) => {
            https.get(status.videoUrl, (res) => {
              const chunks = []
              res.on('data', chunk => chunks.push(chunk))
              res.on('end', () => resolve(Buffer.concat(chunks)))
              res.on('error', reject)
            }).on('error', reject)
          })
          const filename = `genesis-${format}-${result.script}-${Date.now()}.mp4`
          await supabase.storage.from('videos').upload(filename, videoBuffer, { contentType: 'video/mp4' })
          const { data: urlData } = supabase.storage.from('videos').getPublicUrl(filename)
          results[format] = { success: true, url: urlData.publicUrl, script: result.script }
        } else {
          results[format] = { success: false, error: status.error || 'Timeout' }
        }
      } else {
        results[format] = { success: false, error: result.error }
      }
    } catch (e) {
      results[format] = { success: false, error: e.message }
    }
  }
  res.json({ success: true, script: daily.script, scriptKey: daily.key, results })
})

// Get formats info
app.get('/formats', (req, res) => {
  res.json({ formats: VIDEO_FORMATS, scripts: SCRIPT_KEYS, total: SCRIPT_KEYS.length })
})

// ============================================
// START SERVER v3.3
// ============================================
app.listen(PORT, () => {
  console.log('[Genesis Cloud v3.3] Running on port', PORT)
  console.log('  Scripts:', SCRIPT_KEYS.length, '| Formats: youtube, tiktok, instagram, twitter')
  console.log('  NEW: POST /create-multi-format, GET /formats')
})
