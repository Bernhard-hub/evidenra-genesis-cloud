/**
 * EVIDENRA Genesis Cloud - Video Generation Engine
 * =================================================
 * Railway-deployed video creation service
 *
 * Endpoints:
 *   POST /create-video - Create new HeyGen video
 *   GET /status/:id    - Check video status
 *   GET /health        - Health check
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
// AVATARE (junge weibliche)
// ============================================
const AVATARS = [
  { id: 'Abigail_expressive_2024112501', name: 'Abigail' },
  { id: 'Aubrey_expressive_2024112701', name: 'Aubrey' },
  { id: 'Chloe_expressive_2024120201', name: 'Chloe' },
  { id: 'Georgia_expressive_2024112701', name: 'Georgia' },
  { id: 'Jin_expressive_2024112501', name: 'Jin' },
  { id: 'Annie_expressive_public', name: 'Annie Blue' },
  { id: 'Caroline_expressive_public', name: 'Caroline Yellow' },
  { id: 'Amanda_in_Blue_Shirt_Front', name: 'Amanda' },
  { id: 'Diana_public_20240315', name: 'Diana' },
  { id: 'Lisa_public', name: 'Lisa' }
]

const VOICE_FEMALE = 'fb8c5c3f02854c57a4da182d4ed59467' // Ivy English

// ============================================
// VIDEO SCRIPTS
// ============================================
const SCRIPTS = {
  founding: `Hello! I'm excited to introduce you to EVIDENRA - the leading AI-powered qualitative research tool.

Right now, we're offering an exclusive 60% discount for our founding members. That's a massive saving on professional-grade research analysis.

EVIDENRA helps you analyze interviews, focus groups, and documents up to 10 times faster than traditional methods. Our AI understands context, identifies themes, and generates insights automatically.

Don't miss this limited-time offer. Visit evidenra.com today and become a founding member!`,

  students: `Hey there, fellow researcher! Struggling with your thesis data analysis?

EVIDENRA is here to help. Our AI-powered tool makes qualitative research analysis simple and fast.

Upload your interviews, and EVIDENRA automatically identifies themes, codes your data, and even helps write your findings section.

Students get special pricing, and right now founding members save 60%. Visit evidenra.com and transform your research today!`,

  academic: `Qualitative research analysis is time-consuming. We know, because we've been there.

EVIDENRA uses advanced AI to analyze your interviews, focus groups, and documents with academic rigor. Our tool supports multiple methodologies including thematic analysis, grounded theory, and content analysis.

Join leading researchers who trust EVIDENRA. Founding members save 60% - visit evidenra.com now.`
}

// ============================================
// HEYGEN API
// ============================================
async function createHeyGenVideo(topic = 'founding') {
  const apiKey = process.env.HEYGEN_API_KEY
  if (!apiKey) {
    return { success: false, error: 'HEYGEN_API_KEY not configured' }
  }

  const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)]
  const script = SCRIPTS[topic] || SCRIPTS.founding

  console.log(`[Genesis] Creating video with avatar: ${avatar.name}`)

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
        voice_id: VOICE_FEMALE,
        speed: 1.0
      }
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
            resolve({ success: true, videoId: result.data.video_id, avatar: avatar.name })
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
      const storagePath = video.filename.includes('/') ? video.filename : `daily/${video.filename}`
      await supabase.storage.from('videos').remove([storagePath])
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
  res.json({ status: 'ok', service: 'EVIDENRA Genesis Cloud' })
})

// Create new video
app.post('/create-video', async (req, res) => {
  const { topic = 'founding', waitForCompletion = true } = req.body
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
        message: 'Video generation started. Use /status/:id to check progress.'
      })
    }

    // Wait for completion
    console.log(`[Genesis] Waiting for video ${result.videoId}...`)
    const videoUrl = await waitForVideo(result.videoId)

    // Upload to Supabase
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `genesis-${topic}-${timestamp}.mp4`
    const supabaseUrl = await downloadAndUploadToSupabase(videoUrl, filename)

    res.json({
      success: true,
      videoId: result.videoId,
      avatar: result.avatar,
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
║  Video Generation Engine                       ║
╠════════════════════════════════════════════════╣
║  Port: ${PORT}                                    ║
║  Endpoints:                                    ║
║    POST /create-video - Create new video       ║
║    GET  /status/:id   - Check status           ║
║    GET  /videos       - List recent videos     ║
║    GET  /health       - Health check           ║
╚════════════════════════════════════════════════╝
  `)
})
