/**
 * EVIDENRA Genesis Cloud - Video Generation Engine
 * =================================================
 * Railway-deployed video creation service
 * - 14 verschiedene Scripts (täglich rotierend)
 * - Verschiedene Hintergrundbilder
 * - Automatisches Aufräumen alter Videos
 */

require('dotenv').config()
const express = require('express')
const https = require('https')
const { createClient } = require('@supabase/supabase-js')

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3000

// Supabase Client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// ============================================
// AVATARE MIT PASSENDEN STIMMEN
// ============================================
const AVATARS_FEMALE = [
  { id: 'Abigail_expressive_2024112501', name: 'Abigail', gender: 'female' },
  { id: 'Aubrey_expressive_2024112701', name: 'Aubrey', gender: 'female' },
  { id: 'Chloe_expressive_2024120201', name: 'Chloe', gender: 'female' },
  { id: 'Georgia_expressive_2024112701', name: 'Georgia', gender: 'female' },
  { id: 'Jin_expressive_2024112501', name: 'Jin', gender: 'female' },
  { id: 'Annie_expressive_public', name: 'Annie Blue', gender: 'female' },
  { id: 'Caroline_expressive_public', name: 'Caroline Yellow', gender: 'female' },
  { id: 'Amanda_in_Blue_Shirt_Front', name: 'Amanda', gender: 'female' },
  { id: 'Diana_public_20240315', name: 'Diana', gender: 'female' },
  { id: 'Lisa_public', name: 'Lisa', gender: 'female' }
]

const AVATARS_MALE = [
  { id: 'Josh_lite_2_public', name: 'Josh', gender: 'male' },
  { id: 'Wayne_20240711', name: 'Wayne', gender: 'male' },
  { id: 'Tyler_public_lite1_20230601', name: 'Tyler', gender: 'male' },
  { id: 'Edward_public_2_20240207', name: 'Edward', gender: 'male' },
  { id: 'Alvin_expressive_public', name: 'Alvin', gender: 'male' },
  { id: 'Bryan_expressive_public', name: 'Bryan', gender: 'male' }
]

// Alle Avatare kombiniert
const AVATARS = [...AVATARS_FEMALE, ...AVATARS_MALE]

// Stimmen passend zum Geschlecht
const VOICES = {
  female: 'fb8c5c3f02854c57a4da182d4ed59467', // Ivy (weiblich englisch)
  male: '2f9fdbc8db6047c8b5a6278b1a6acfe1'    // Matthew (männlich englisch)
}

// ============================================
// HINTERGRUNDBILDER (Stock Images - frei nutzbar)
// ============================================
const BACKGROUNDS = [
  { type: 'color', value: '#1a1a2e' },  // Dunkelblau
  { type: 'color', value: '#0f0f23' },  // Fast Schwarz
  { type: 'color', value: '#1e3a5f' },  // Navy
  { type: 'color', value: '#2d1b4e' },  // Lila Dunkel
  { type: 'color', value: '#0a2540' },  // Mitternachtsblau
  { type: 'color', value: '#1a1a1a' },  // Anthrazit
  { type: 'color', value: '#0d2137' },  // Tiefblau
  { type: 'color', value: '#1f1135' },  // Violett
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

// Script-Namen für tägliche Rotation
const SCRIPT_KEYS = Object.keys(SCRIPTS)

// Tägliches Script basierend auf Datum
function getDailyScript() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
  const index = dayOfYear % SCRIPT_KEYS.length
  return SCRIPT_KEYS[index]
}

// Zufälliger Hintergrund
function getRandomBackground() {
  return BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)]
}

// ============================================
// HEYGEN API
// ============================================
async function createHeyGenVideo(topic = 'auto') {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) {
    return { success: false, error: 'HEYGEN_API_KEY not configured' }
  }

  // Wenn 'auto', nutze tägliches Script
  const scriptKey = topic === 'auto' ? getDailyScript() : (SCRIPTS[topic] ? topic : getDailyScript())
  const script = SCRIPTS[scriptKey]
  const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)]
  const background = getRandomBackground()

  // WICHTIG: Stimme passend zum Avatar-Geschlecht!
  const voice = VOICES[avatar.gender] || VOICES.female

  console.log(`[Genesis] Creating video:`)
  console.log(`  - Script: ${scriptKey}`)
  console.log(`  - Avatar: ${avatar.name} (${avatar.gender})`)
  console.log(`  - Voice: ${avatar.gender}`)
  console.log(`  - Background: ${background.value}`)

  const payload = JSON.stringify({
    video_inputs: [{
      character: {
        type: 'avatar',
        avatar_id: avatar.id,
        avatar_style: 'normal',
        scale: 1.5
      },
      voice: {
        type: 'text',
        input_text: script,
        voice_id: voice,
        speed: 1.0
      },
      background: background
    }],
    dimension: { width: 1920, height: 1080 },
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
  const scriptKey = getDailyScript()
  res.json({
    date: new Date().toISOString().split('T')[0],
    script: scriptKey,
    text: SCRIPTS[scriptKey],
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
      return res.status(500).json({ error: result.error })
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

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║  EVIDENRA Genesis Cloud                        ║
║  Video Generation Engine v2.0                  ║
╠════════════════════════════════════════════════╣
║  Port: ${PORT}                                    ║
║  Scripts: ${SCRIPT_KEYS.length} verschiedene                      ║
║  Today: ${getDailyScript().padEnd(30)}    ║
╠════════════════════════════════════════════════╣
║  Endpoints:                                    ║
║    POST /create-video - Create new video       ║
║    GET  /today        - Today's script         ║
║    GET  /status/:id   - Check status           ║
║    GET  /videos       - List recent videos     ║
║    GET  /health       - Health check           ║
╚════════════════════════════════════════════════╝
  `)
})
