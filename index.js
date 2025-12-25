/**
 * EVIDENRA Genesis Cloud - Video Generation Engine v2.0
 * ======================================================
 * Railway-deployed video creation service
 * - Screen Recording mit Playwright
 * - HeyGen Avatar Videos
 * - FFmpeg Compositing (Avatar über Hintergrund)
 * - 14 verschiedene Scripts (täglich rotierend)
 * - Automatisches Aufräumen alter Videos
 */

require('dotenv').config()
const express = require('express')
const https = require('https')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { createClient } = require('@supabase/supabase-js')
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

async function createHeyGenVideo(topic = 'auto', useGreenscreen = false) {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) {
    return { success: false, error: 'HEYGEN_API_KEY not configured' }
  }

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
  console.log(`  - Background: ${useGreenscreen ? 'GREENSCREEN' : background.value}`)

  const payload = JSON.stringify({
    video_inputs: [{
      character: {
        type: 'avatar',
        avatar_id: avatar.id,
        avatar_style: 'normal',
        scale: 0.85  // Etwas kleiner für bessere Einpassung
      },
      voice: {
        type: 'text',
        input_text: script,
        voice_id: voice,
        speed: 1.0
      },
      background: background
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
          if (result.data?.video_id) {
            resolve({
              success: true,
              videoId: result.data.video_id,
              avatar: avatar.name,
              script: scriptKey
            })
          } else {
            resolve({ success: false, error: result.error?.message || 'HeyGen error' })
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
          resolve({
            status: result.data?.status || 'unknown',
            videoUrl: result.data?.video_url,
            error: result.data?.error
          })
        } catch (e) {
          resolve({ status: 'error', error: e.message })
        }
      })
    })
    req.on('error', (e) => resolve({ status: 'error', error: e.message }))
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
      throw new Error(status.error || 'Video generation failed')
    }

    await new Promise(r => setTimeout(r, 15000))
  }

  throw new Error('Video generation timeout')
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
  console.log(`[Genesis] === FULL VIDEO PIPELINE ===`)
  console.log(`  Topic: ${topic}`)
  console.log(`  Demo: ${demoType}`)

  // Schritt 1: Hintergrund-Video aufnehmen
  console.log(`[Genesis] Step 1: Recording background...`)
  let backgroundPath
  try {
    backgroundPath = await recordBackground(demoType)
    console.log(`[Genesis] Background recorded successfully: ${backgroundPath}`)
  } catch (err) {
    console.error(`[Genesis] Background recording FAILED:`, err.message)
    console.error(`[Genesis] Full error:`, err.stack)
    backgroundPath = null
  }

  // Schritt 2: HeyGen Avatar erstellen
  // PRIORITÄT: WebM mit transparentem Hintergrund (kein Chroma-Key nötig!)
  console.log(`[Genesis] Step 2: Creating HeyGen avatar video...`)
  console.log(`[Genesis]   Trying WebM with transparent background first...`)

  let heygenResult = await createHeyGenWebM(topic)
  let isWebM = heygenResult.success && heygenResult.format === 'webm'

  // Fallback auf Green Screen wenn WebM fehlschlägt
  if (!heygenResult.success) {
    console.log(`[Genesis]   WebM not available, falling back to green screen...`)
    heygenResult = await createHeyGenVideo(topic, true) // true = greenscreen
    isWebM = false
  }

  if (!heygenResult.success) {
    const errorMsg = typeof heygenResult.error === 'string'
      ? heygenResult.error
      : JSON.stringify(heygenResult.error) || 'HeyGen failed'
    throw new Error(errorMsg)
  }

  // Auf HeyGen warten
  console.log(`[Genesis] Step 3: Waiting for HeyGen...`)
  const avatarUrl = await waitForVideo(heygenResult.videoId)

  // Avatar herunterladen (WebM oder MP4)
  const avatarExt = isWebM ? 'webm' : 'mp4'
  const avatarPath = path.join(TEMP_DIR, `avatar-${Date.now()}.${avatarExt}`)
  await downloadVideo(avatarUrl, avatarPath)
  console.log(`[Genesis] Avatar downloaded: ${avatarPath} (${isWebM ? 'WebM transparent' : 'MP4 greenscreen'})`)

  let finalPath
  if (backgroundPath && fs.existsSync(backgroundPath)) {
    finalPath = path.join(TEMP_DIR, `final-${Date.now()}.mp4`)

    if (isWebM) {
      // WebM mit transparentem Hintergrund - einfaches Overlay ohne Chroma-Key!
      console.log(`[Genesis] Step 4: Compositing WebM (transparent) over background...`)
      const overlayCmd = `ffmpeg -y -i "${backgroundPath}" -i "${avatarPath}" -filter_complex "[1:v]scale=350:-1[avatar];[0:v][avatar]overlay=W-w-10:H-h+60:shortest=1,drawbox=x=W-170:y=H-35:w=165:h=30:color=black@0.95:t=fill,drawtext=text=EVIDENRA.com:fontcolor=white:fontsize=14:x=W-165:y=H-28[outv]" -map "[outv]" -map 1:a -c:v libx264 -preset fast -crf 21 -c:a aac -b:a 192k "${finalPath}"`

      try {
        execSync(overlayCmd, { stdio: 'pipe', timeout: 300000 })
        console.log(`[Genesis] WebM composite created successfully!`)
      } catch (err) {
        console.error(`[Genesis] WebM overlay failed:`, err.message)
        // Fallback: Chromakey
        compositeVideos(backgroundPath, avatarPath, finalPath, true)
      }
    } else {
      // Green Screen - Chroma-Key nötig
      console.log(`[Genesis] Step 4: Compositing with Chroma-Key + Logo Overlay...`)
      compositeVideos(backgroundPath, avatarPath, finalPath, true)
    }

    // Cleanup Hintergrund
    fs.unlinkSync(backgroundPath)
    // Cleanup Avatar (wurde in finalPath integriert)
    if (avatarPath !== finalPath && fs.existsSync(avatarPath)) {
      fs.unlinkSync(avatarPath)
    }
  } else {
    // Nur Avatar (kein Hintergrund) - füge trotzdem Logo hinzu
    console.log(`[Genesis] Step 4: Adding logo overlay to avatar...`)
    finalPath = path.join(TEMP_DIR, `final-${Date.now()}.mp4`)

    // Einfaches Logo-Overlay auf Avatar
    const logoCmd = `ffmpeg -y -i "${avatarPath}" -filter_complex "drawbox=x=W-180:y=H-45:w=175:h=40:color=black@0.85:t=fill,drawtext=text='EVIDENRA.com':fontcolor=white:fontsize=18:x=W-170:y=H-35[outv]" -map "[outv]" -map 0:a -c:v libx264 -preset fast -crf 21 -c:a copy "${finalPath}"`

    try {
      execSync(logoCmd, { stdio: 'pipe', timeout: 120000 })
      fs.unlinkSync(avatarPath)
    } catch (err) {
      console.log(`[Genesis] Logo overlay failed, using original avatar`)
      finalPath = avatarPath
    }
  }

  return {
    videoPath: finalPath,
    avatarUrl,
    avatar: heygenResult.avatar,
    script: heygenResult.script
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
    res.status(500).json({ error: e.message })
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

// Create FULL video (Background Recording + Avatar + Composite)
app.post('/create-full-video', async (req, res) => {
  const { topic = 'auto', demoType = 'demo' } = req.body
  const authHeader = req.headers.authorization

  if (authHeader !== `Bearer ${process.env.GENESIS_API_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  console.log(`[Genesis] === FULL VIDEO REQUEST ===`)
  console.log(`  Topic: ${topic}, Demo: ${demoType}`)

  try {
    // Full Pipeline: Record + Avatar + Composite
    const result = await createFullVideo(topic, demoType)

    // Upload final video to Supabase
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `genesis-full-${result.script}-${timestamp}.mp4`

    console.log(`[Genesis] Uploading final video to Supabase...`)
    const videoBuffer = fs.readFileSync(result.videoPath)

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

    // Cleanup temp files
    if (fs.existsSync(result.videoPath)) {
      fs.unlinkSync(result.videoPath)
    }

    res.json({
      success: true,
      mode: 'full',
      avatar: result.avatar,
      script: result.script,
      supabaseUrl,
      filename
    })

  } catch (e) {
    console.error('[Genesis] Full video error:', e)
    res.status(500).json({ error: e.message })
  }
})

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║  EVIDENRA Genesis Cloud v2.0                       ║
║  Full Video Generation Engine                      ║
╠════════════════════════════════════════════════════╣
║  Port: ${PORT}                                        ║
║  Scripts: ${SCRIPT_KEYS.length} verschiedene                          ║
║  Avatars: ${AVATARS.length} (${AVATARS_FEMALE.length}F + ${AVATARS_MALE.length}M)                              ║
║  Today: ${getDailyScript().key.padEnd(34)}    ║
╠════════════════════════════════════════════════════╣
║  Endpoints:                                        ║
║    POST /create-video      - Avatar only           ║
║    POST /create-full-video - BG + Avatar + FFmpeg  ║
║    GET  /today             - Today's script        ║
║    GET  /status/:id   - Check status           ║
║    GET  /videos       - List recent videos     ║
║    GET  /health       - Health check           ║
╚════════════════════════════════════════════════╝
  `)
})
